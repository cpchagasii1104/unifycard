#!/usr/bin/env node
// Gate estrutural — F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136).
// Trava os invariantes de segurança do substrato de capability grants por actor:
//   - allowlist NÃO-financeira (migration CHECK + service); proibido financial/split/cards/cash_drawer/
//     customer_credit/payout/ledger/refund/payment/transfer;
//   - scope só 'actor' (sem 'global') no MVP;
//   - grant é por actor_id (grantee/scope/concedente), nunca slug/users.referral_code;
//   - lookup usa actors.slug, NUNCA users.referral_code;
//   - NENHUMA rota de negócio (.routes.ts) chama hasCapabilityGrant/importa o grant service —
//     o enforcement vive no SERVICE layer (DECISION-0136/0138 Slice 1C);
//   - Slice 1C ATIVO: services.service.ts.createService COMPÕE hasCapabilityGrant('services:create')
//     de forma ADITIVA (não pode sumir silenciosamente — seção 7).
// Integrado em validate:regression-guards. Heurística textual, não AST.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const MIG = join(ROOT, 'migrations', '20260616210000_create_actor_capability_grants.sql');
const SVC = join(SRC, 'modules/authority/actor-capability-grant.service.ts');
const TYPES = join(SRC, 'modules/authority/actor-capability-grant.types.ts');
const REPO = join(SRC, 'modules/authority/actor-capability-grant.repository.ts');
const LOOKUP = join(SRC, 'modules/authority/actor-lookup.service.ts');

const FINANCIAL = /\b(financial:|financial_terms:|split:|cards:|cash_drawer:|customer_credit:|suppliers:credit_|payout|ledger|refund|payment|transfer)\b/i;

const failures = [];
let checked = 0;

const stripSql = (s) => s.replace(/--[^\n]*/g, '');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

function read(p) { return existsSync(p) ? readFileSync(p, 'utf8') : null; }

// 1) Migration existe e é segura.
{
  const rawSql = read(MIG);
  const sql = rawSql ? stripSql(rawSql) : null;
  if (!sql) {
    failures.push('GRANTS_REGRESSION: migration actor_capability_grants ausente.');
  } else {
    checked++;
    if (!/chk_acg_capability_nonfinancial/.test(sql) || !/capability_key IN \(/.test(sql)) {
      failures.push('GRANTS_REGRESSION: migration sem CHECK de allowlist (chk_acg_capability_nonfinancial).');
    }
    // O CHECK de allowlist NÃO pode conter capability financeira.
    const checkBlock = (sql.match(/chk_acg_capability_nonfinancial CHECK \([\s\S]*?\)\s*\)/) || [''])[0];
    if (FINANCIAL.test(checkBlock)) {
      failures.push('GRANTS_REGRESSION: allowlist da migration contém capability FINANCEIRA (proibido).');
    }
    if (!/CONSTRAINT chk_acg_scope_type CHECK \(scope_type = 'actor'\)/.test(sql)) {
      failures.push("GRANTS_REGRESSION: migration sem CHECK scope_type='actor' (sem 'global' no MVP).");
    }
    if (/'global'/.test(sql)) {
      failures.push("GRANTS_REGRESSION: migration menciona scope 'global' (proibido no Slice 1).");
    }
    if (!/grantee_actor_id\s+UUID NOT NULL/.test(sql) || !/granted_by_actor_id\s+UUID NOT NULL/.test(sql)) {
      failures.push('GRANTS_REGRESSION: grant precisa de grantee_actor_id E granted_by_actor_id NOT NULL (actor, não user-only).');
    }
    if (/referral_code/.test(sql)) {
      failures.push('GRANTS_REGRESSION: migration referencia referral_code (lookup comercial ≠ authority — proibido).');
    }
  }
}

// 2) Service: allowlist não-financeira + sem referral_code.
{
  const svc = (read(SVC) && stripTs(read(SVC)));
  const types = (read(TYPES) && stripTs(read(TYPES)));
  if (!svc || !types) {
    failures.push('GRANTS_REGRESSION: service/types de actor-capability-grant ausentes.');
  } else {
    checked++;
    if (FINANCIAL.test((types.match(/NON_FINANCIAL_CAPABILITY_ALLOWLIST[\s\S]*?\]/) || [''])[0])) {
      failures.push('GRANTS_REGRESSION: allowlist do service/types contém capability FINANCEIRA (proibido).');
    }
    if (!/canRepresentActor\(/.test(svc)) {
      failures.push('GRANTS_REGRESSION: service não valida o concedente via canRepresentActor (autoridade do escopo).');
    }
    if (/users\.referral_code|referral_code/.test(svc)) {
      failures.push('GRANTS_REGRESSION: service usa referral_code (comercial ≠ authority — proibido).');
    }
  }
}

// 3) Lookup usa actors.slug, NUNCA users.referral_code.
{
  const lk = (read(LOOKUP) && stripTs(read(LOOKUP)));
  if (!lk) {
    failures.push('GRANTS_REGRESSION: actor-lookup.service ausente.');
  } else {
    checked++;
    if (!/FROM actors WHERE tenant_id=\$1::uuid AND slug=/.test(lk)) {
      failures.push('GRANTS_REGRESSION: lookup não resolve por actors.slug tenant-scoped.');
    }
    if (/referral_code/.test(lk)) {
      failures.push('GRANTS_REGRESSION: lookup usa referral_code (proibido — usar actors.slug).');
    }
  }
}

// 4) Enforcement deferido: SÓ a rota de GESTÃO de grants pode importar o service; nenhuma rota de NEGÓCIO
//    pode importar; e `hasCapabilityGrant` (primitivo de enforcement) NÃO pode aparecer em rota nenhuma (1C).
const GRANT_ROUTES_REL = 'modules/authority/actor-capability-grant.routes.ts';
{
  const routeFiles = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) { if (e !== 'node_modules') walk(full); }
      else if (extname(full) === '.ts' && full.endsWith('.routes.ts')) routeFiles.push(full);
    }
  })(SRC);
  for (const f of routeFiles) {
    const rel = f.replace(SRC, '').replace(/\\/g, '/').replace(/^\//, '');
    const code = stripTs(readFileSync(f, 'utf8'));
    const isMgmt = rel === GRANT_ROUTES_REL;
    if (!isMgmt && /actorCapabilityGrantService/.test(code)) {
      failures.push(`GRANTS_REGRESSION: rota ${rel} importa o grant service — só a rota de gestão (${GRANT_ROUTES_REL}) pode; enforcement em rota de negócio é Slice FUTURO (DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION).`);
    }
    if (/hasCapabilityGrant\(/.test(code)) {
      failures.push(`GRANTS_REGRESSION: rota ${rel} usa hasCapabilityGrant( — enforcement em rota é Slice 1C (decisão de produto), proibido agora.`);
    }
  }
  checked++;
}

// 6) Invariantes da rota de GESTÃO de grants (Slice 1B).
{
  const p = join(SRC, GRANT_ROUTES_REL);
  if (existsSync(p)) {
    checked++;
    const code = stripTs(readFileSync(p, 'utf8'));
    // capability vem da allowlist não-financeira (z.enum) — sem hardcode de key financeira.
    if (FINANCIAL.test(code)) {
      failures.push(`GRANTS_REGRESSION: ${GRANT_ROUTES_REL} referencia capability/termo FINANCEIRO (proibido no Slice 1B).`);
    }
    if (!/NON_FINANCIAL_CAPABILITY_ALLOWLIST/.test(code)) {
      failures.push(`GRANTS_REGRESSION: ${GRANT_ROUTES_REL} não valida capabilityKey contra a allowlist não-financeira (z.enum).`);
    }
    // nada de referral comercial / vocabulários paralelos / rbac como autoridade do grant.
    for (const [re, why] of [
      [/referral_code/, 'usa referral_code (comercial ≠ authority)'],
      [/business-permissions|BusinessPermission|BusinessAction/, 'usa business-permissions.types.ts (vocabulário paralelo)'],
      [/PermissionString|requirePermission|rbac\.plugin/, 'usa rbac PermissionString/requirePermission como autoridade do grant'],
      [/scope_type\s*[:=]\s*'global'|'global'/, "introduz scope 'global' (proibido)"],
      [/DELETE FROM actor_capability_grants/i, 'faz DELETE físico de grant (revogação é status)'],
      [/availability|calendar\.routes|unified-availability/, 'toca availability/calendar (proibido)'],
    ]) {
      if (re.test(code)) failures.push(`GRANTS_REGRESSION: ${GRANT_ROUTES_REL} ${why}.`);
    }
    // autoridade do endpoint = canRepresentActor (gate de scope) + grava actor_id.
    if (!/canRepresentActor\(/.test(code)) {
      failures.push(`GRANTS_REGRESSION: ${GRANT_ROUTES_REL} não usa canRepresentActor (autoridade do scope no GET).`);
    }
    // GET list exige scopeActorId (sem listagem global): scopeActorId é campo obrigatório no schema de list.
    if (!/scopeActorId:\s*z\.string\(\)\.uuid\(\),/.test(code)) {
      failures.push(`GRANTS_REGRESSION: ${GRANT_ROUTES_REL} não exige scopeActorId obrigatório (risco de listagem global).`);
    }
  }
}

// 5) ALINHAMENTO COM O SSOT VIVO (DECISION-0136 W1): toda capability permitida no CHECK da migration DEVE
//    existir em permission-keys.ts. O CHECK do banco é trava defensiva — NÃO pode virar registry paralelo.
{
  const rawSql = read(MIG);
  const PK = join(SRC, 'core/authorization/permission-keys.ts');
  const pk = read(PK);
  if (rawSql && pk) {
    checked++;
    const checkBlock = (stripSql(rawSql).match(/chk_acg_capability_nonfinancial CHECK \([\s\S]*?\)\s*\)/) || [''])[0];
    const allow = [...checkBlock.matchAll(/'([a-z_]+:[a-z_]+)'/g)].map((m) => m[1]);
    if (allow.length === 0) {
      failures.push('GRANTS_REGRESSION: não foi possível extrair a allowlist do CHECK da migration.');
    }
    for (const key of allow) {
      if (FINANCIAL.test(key)) {
        failures.push(`GRANTS_REGRESSION: allowlist contém capability FINANCEIRA '${key}' (proibido).`);
      }
      // a key precisa existir como literal no PERMISSION_CAPABILITIES (registry vivo).
      if (!new RegExp(`'${key.replace(/[:]/g, '\\:')}':\\s*null`).test(pk) && !pk.includes(`'${key}':`)) {
        failures.push(`GRANTS_REGRESSION: capability '${key}' está na allowlist da migration mas NÃO existe em permission-keys.ts (CHECK ≠ registry — DECISION-0136 W1).`);
      }
    }
    // permission-keys.ts não pode ganhar domínio financeiro errado 'finance:' (canônico é 'financial:').
    if (/'finance:[a-z_]+'/.test(pk)) {
      failures.push("GRANTS_REGRESSION: permission-keys.ts contém key 'finance:*' — o domínio canônico é 'financial:' (DECISION-0135).");
    }
  }
}

// 7) ENFORCEMENT Slice 1C (DECISION-0136/0138): services.service.ts.createService DEVE compor
//    hasCapabilityGrant('services:create') de forma ADITIVA (fail-closed) — a capability não pode
//    ficar SEM enforcement (regressão silenciosa). Aditivo = canRepresentActor OU grant, senão 403.
{
  const SVC_CREATE = join(SRC, 'modules/services/services.service.ts');
  const code = read(SVC_CREATE) && stripTs(read(SVC_CREATE));
  if (!code) {
    failures.push('GRANTS_REGRESSION: services.service.ts ausente (enforcement Slice 1C não verificável).');
  } else {
    checked++;
    if (!/hasCapabilityGrant\([^)]*['"]services:create['"]/.test(code)) {
      failures.push("GRANTS_REGRESSION: services.service.ts NÃO compõe hasCapabilityGrant('services:create') — enforcement Slice 1C ausente/regrediu (DECISION-0136/0138).");
    }
    // edit/disable (F-...-SERVICES-EDIT-DISABLE): updateService compõe services:edit E services:disable,
    // com disable = transição → 'paused' e exigência de TODAS as caps no caso misto (Set requiredCaps).
    if (!/['"]services:edit['"]/.test(code)) {
      failures.push("GRANTS_REGRESSION: services.service.ts NÃO referencia 'services:edit' — enforcement de edição ausente/regrediu.");
    }
    if (!/['"]services:disable['"]/.test(code)) {
      failures.push("GRANTS_REGRESSION: services.service.ts NÃO referencia 'services:disable' — enforcement de desativação ausente/regrediu.");
    }
    if (!/isDisableTransition/.test(code) || !/requiredCaps/.test(code)) {
      failures.push('GRANTS_REGRESSION: services.service.ts perdeu a classificação disable/edit (isDisableTransition/requiredCaps) — caso misto deixaria de exigir AMBAS as capabilities.');
    }
    if (!/hasCapabilityGrant\([^)]*ServiceStatus\.PAUSED|PAUSED/.test(code)) {
      failures.push("GRANTS_REGRESSION: services.service.ts não amarra disable à transição 'paused' (ServiceStatus.PAUSED ausente na composição).");
    }
    if (!/canRepresentActor\(/.test(code)) {
      failures.push('GRANTS_REGRESSION: services.service.ts perdeu canRepresentActor — composição aditiva exige owner/self ANTES do grant.');
    }
    // sem WILDCARD / PREFIX-MATCH de capability (match deve ser EXATO por key).
    if (/['"]services:\*['"]/.test(code)) {
      failures.push("GRANTS_REGRESSION: services.service.ts usa wildcard 'services:*' (match de capability deve ser EXATO).");
    }
    if (/\.startsWith\(\s*['"]services:/.test(code)) {
      failures.push('GRANTS_REGRESSION: services.service.ts usa prefix-match de capability (.startsWith services:) — match deve ser EXATO.');
    }
    if (/referral_code/.test(code)) {
      failures.push('GRANTS_REGRESSION: services.service.ts usa referral_code (comercial ≠ authority — proibido).');
    }
  }
}

console.log(`[actor-capability-grants-nonfinancial] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [actor-capability-grants-nonfinancial]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [actor-capability-grants-nonfinancial] — allowlist não-financeira; scope actor-only; grant por actor_id; lookup por actors.slug; zero referral comercial; zero enforcement em rota de negócio.');
