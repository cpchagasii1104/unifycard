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
    failures.push('company-members.service: perdeu getRelationshipTypeForRole — vínculo jurídico não é mais derivado do role.');
  }
}

console.log(`[r2-delegation-writer-governed] failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [r2-delegation-writer-governed]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [r2-delegation-writer-governed] — grant/revoke atômicos (delegação+evento na mesma TX); vocabulário validado; repositório é persistência (sem gate de autoridade); events append-only; zero bank_*; company-members passa autoria+vínculo.');
