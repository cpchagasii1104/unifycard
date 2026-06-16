#!/usr/bin/env node
// Gate estrutural — F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136).
// Trava os invariantes de segurança do substrato de capability grants por actor:
//   - allowlist NÃO-financeira (migration CHECK + service); proibido financial/split/cards/cash_drawer/
//     customer_credit/payout/ledger/refund/payment/transfer;
//   - scope só 'actor' (sem 'global') no MVP;
//   - grant é por actor_id (grantee/scope/concedente), nunca slug/users.referral_code;
//   - lookup usa actors.slug, NUNCA users.referral_code;
//   - NENHUMA rota de negócio importa o service (enforcement = Slice futuro; superfície selada intocada).
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

// 4) NENHUMA rota de negócio importa o grant service (enforcement deferido; superfície selada intocada).
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
    const code = readFileSync(f, 'utf8');
    if (/actor-capability-grant\.service|actorCapabilityGrantService/.test(code)) {
      const rel = f.replace(SRC, '').replace(/\\/g, '/');
      failures.push(`GRANTS_REGRESSION: rota ${rel} importa o grant service — enforcement em rota de negócio é Slice FUTURO (DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION).`);
    }
  }
  checked++;
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

console.log(`[actor-capability-grants-nonfinancial] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [actor-capability-grants-nonfinancial]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [actor-capability-grants-nonfinancial] — allowlist não-financeira; scope actor-only; grant por actor_id; lookup por actors.slug; zero referral comercial; zero enforcement em rota de negócio.');
