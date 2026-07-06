#!/usr/bin/env node
// Gate estrutural — R2.2 (Lote L2): writer governado de delegação + trilha append-only atômica.
// O repositório actor-delegation é a camada de PERSISTÊNCIA governada (não de autorização — o gate
// canManageCompany vive na porta selada da Fatia 2). Este gate trava as invariantes de R2.2:
//   1) grant e revoke emitem evento na MESMA transação (delegação e evento juntos — atomicidade);
//   2) o repositório NÃO decide autoridade (sem canManageCompany/canRepresentActor — persistência, não gate);
//   3) o vocabulário de vínculo (relationship_type) é validado antes do INSERT;
//   4) actor_delegation_events nunca sofre UPDATE/DELETE em código (append-only).
// Heurística textual comment-stripped. Em validate:regression-guards. Falso positivo = mais restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REPO = join(ROOT, 'src', 'core', 'actor-delegation', 'actor-delegation.repository.ts');
const MEMBERS = join(ROOT, 'src', 'core', 'companies', 'company-members.service.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

if (!existsSync(REPO)) {
  failures.push(`arquivo ausente: ${REPO}`);
} else {
  const code = stripTs(readFileSync(REPO, 'utf8'));

  // 1. Transação atômica: BEGIN + COMMIT + ROLLBACK presentes (grant/revoke não podem ser query solta).
  if (!/BEGIN/.test(code) || !/COMMIT/.test(code) || !/ROLLBACK/.test(code)) {
    failures.push('actor-delegation.repository: perdeu BEGIN/COMMIT/ROLLBACK — grant/revoke devem ser atômicos (delegação + evento na mesma transação).');
  }
  // 2. Emissão de evento em ambos os caminhos: pelo menos 2 INSERTs em actor_delegation_events (granted + revoked).
  const eventInserts = (code.match(/INSERT INTO actor_delegation_events/g) || []).length;
  if (eventInserts < 2) {
    failures.push(`actor-delegation.repository: esperado >= 2 INSERT em actor_delegation_events (granted + revoked), encontrados ${eventInserts}.`);
  }
  // 3. event_type 'granted' e 'revoked' ambos emitidos.
  if (!/'granted'/.test(code)) failures.push("actor-delegation.repository: não emite evento 'granted'.");
  if (!/'revoked'/.test(code)) failures.push("actor-delegation.repository: não emite evento 'revoked'.");
  // 4. Validação do vocabulário antes do INSERT (relationship_type inválido rejeitado no writer, não só no CHECK).
  if (!/DELEGATION_RELATIONSHIP_TYPES/.test(code)) {
    failures.push('actor-delegation.repository: perdeu a validação DELEGATION_RELATIONSHIP_TYPES do vínculo antes do INSERT.');
  }
  // 5. PROIBIDO: o repositório NÃO decide autoridade (persistência, não gate — o gate é a porta selada Fatia 2).
  for (const m of [/canManageCompany/, /canRepresentActor/, /requireFinancialRiskClearance/]) {
    if (m.test(code)) {
      failures.push(`actor-delegation.repository: introduziu decisão de autoridade (${m}) — o repositório é PERSISTÊNCIA; o gate vive na porta selada (Fatia 2 / company-members).`);
    }
  }
  // 6. Append-only: PROIBIDO UPDATE ou DELETE em actor_delegation_events em código.
  if (/UPDATE\s+actor_delegation_events|DELETE\s+FROM\s+actor_delegation_events/i.test(code)) {
    failures.push('actor-delegation.repository: UPDATE/DELETE em actor_delegation_events — a trilha é append-only (correção = novo evento).');
  }
  // 7. PROIBIDO: escrita em bank_* (D4 — escopo financeiro FORA de R2).
  if (/bank_ledger|bank_transactions|bank_splits/.test(code)) {
    failures.push('actor-delegation.repository: referencia bank_* — R2 é autoridade, escopo financeiro FORA (D4).');
  }
}

if (!existsSync(MEMBERS)) {
  failures.push(`arquivo ausente: ${MEMBERS}`);
} else {
  const code = stripTs(readFileSync(MEMBERS, 'utf8'));
  // 8. company-members passa grantedByActorId + relationshipType ao criar delegação (autoria + vínculo).
  if (!/grantedByActorId/.test(code)) {
    failures.push('company-members.service: não passa grantedByActorId ao criar delegação — autoria da concessão perdida (§4.9.9).');
  }
  if (!/getRelationshipTypeForRole/.test(code)) {
    failures.push('company-members.service: perdeu getRelationshipTypeForRole — vínculo jurídico (fallback do role) removido.');
  }
  // R2 FIX RN2/R2.2: o vínculo jurídico deve poder vir EXPLÍCITO (fonte governada), não só derivado 1:1
  // do role (que deixava 4/7 valores mortos + owner→null). explicitRelationshipType tem precedência.
  if (!/explicitRelationshipType/.test(code)) {
    failures.push('company-members.service: perdeu explicitRelationshipType — o vínculo jurídico voltou a ser SÓ derivado do role (4/7 valores mortos, owner→null; ressalva RN2/R2.2 da auditoria normativa).');
  }
}

// 9. R2.2 FIX-Q3 (autoria não-forjável, ressalva Yala): TODA rota que grava autoria de delegação
// (granted_by/revoked_by = actionContext.actorId) deve validar canRepresentActor(principal, actionContext.
// actorId) fail-closed ANTES do write — senão a autoria da trilha §4.9.9 é spoofável.
// Cada rota que grava autoria precisa INVOCAR o gate (não só defini-lo). `minCalls` = nº de writes
// de autoria naquele arquivo (members: POST grant + DELETE revoke = 2; bridge: 1 grant).
const AUTHORSHIP_ROUTES = [
  { rel: 'src/core/companies/company-members.routes.ts', callRe: /requireRepresentsActingActor\s*\(\s*req\s*,\s*reply\s*\)/g, minCalls: 3 },
  { rel: 'src/modules/relationships/actor-relationship-membership-bridge.routes.ts', callRe: /canRepresentActor\s*\(\s*tenantId\s*,\s*callerUserId\s*,\s*actionContext\.actorId/g, minCalls: 1 },
];
for (const { rel, callRe, minCalls } of AUTHORSHIP_ROUTES) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente (rota de autoria): ${rel}`); continue; }
  const code = stripTs(readFileSync(p, 'utf8'));
  if (!/canRepresentActor/.test(code)) {
    failures.push(`${rel}: R2.2 FIX-Q3 — perdeu canRepresentActor; autoria de delegação (granted_by/revoked_by) volta a ser spoofável.`);
  }
  const calls = (code.match(callRe) || []).length;
  if (calls < minCalls) {
    failures.push(`${rel}: R2.2 FIX-Q3 — gate de representação do actor concedente/revogador INVOCADO ${calls}x, esperado >= ${minCalls} (todo write de autoria precisa do gate ANTES).`);
  }
}

console.log(`[r2-delegation-writer-governed] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [r2-delegation-writer-governed]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [r2-delegation-writer-governed] — grant/revoke atômicos (delegação+evento na mesma TX); vocabulário validado; repositório é persistência (sem gate de autoridade); events append-only; zero bank_*; company-members passa autoria+vínculo.');
