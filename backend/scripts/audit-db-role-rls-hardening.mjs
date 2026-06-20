#!/usr/bin/env node
// Guard estrutural — F-DB-ROLE-AND-RLS-HARDENING. Garante que o hardening de DB-role/RLS
// permaneça íntegro: app role NOSUPERUSER/NOBYPASSRLS, RLS+FORCE+policy tenant-scoped nas 7
// tabelas payout/approval/recovery, sem USING(true) app-facing, sem DISABLE/row_security=off,
// sem relaxar bank_*, e pre-flight fail-closed presente + wired no boot.
//
// Em validate:regression-guards. MORDE se qualquer invariante acima for quebrada.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'migrations');
const PREFLIGHT = join(ROOT, 'src/core/database/db-role-rls-preflight.ts');
const BOOT = join(ROOT, 'BOOT.ts');

// remove comentários SQL de linha (-- ...) para não confundir rollback comentado com SQL ativo.
const stripSqlComments = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const FINANCIAL_TABLES = [
  'actor_wallet_payout_requests',
  'financial_approval_policies',
  'financial_approval_authorities',
  'financial_approval_policy_events',
  'approval_requests',
  'actor_wallet_recovery_obligations',
  'actor_wallet_recovery_obligation_entries',
];
const BANK_TABLES = ['bank_ledger', 'bank_transactions', 'bank_accounts', 'bank_splits'];

const failures = [];

// ── localizar a migration de hardening ────────────────────────────────────────
let hardeningFile = null;
if (existsSync(MIGRATIONS)) {
  const f = readdirSync(MIGRATIONS).find((n) => /db_role_rls_hardening\.sql$/.test(n));
  if (f) hardeningFile = join(MIGRATIONS, f);
}
if (!hardeningFile) {
  failures.push('migration *_db_role_rls_hardening.sql ausente — hardening de DB-role/RLS não materializado.');
} else {
  const raw = readFileSync(hardeningFile, 'utf-8');
  const sql = stripSqlComments(raw);

  // app role: NOSUPERUSER + NOBYPASSRLS; nunca SUPERUSER/BYPASSRLS "nus".
  if (!/unificard_app[\s\S]{0,120}?NOSUPERUSER/i.test(sql)) failures.push('migration: unificard_app sem NOSUPERUSER.');
  if (!/unificard_app[\s\S]{0,120}?NOBYPASSRLS/i.test(sql)) failures.push('migration: unificard_app sem NOBYPASSRLS.');
  // bare SUPERUSER/BYPASSRLS associados à app role (não precedidos de NO) = inseguro.
  for (const m of sql.matchAll(/unificard_app[^\n;]*/gi)) {
    const seg = m[0];
    if (/(?<!NO)SUPERUSER/i.test(seg)) failures.push('migration: unificard_app com SUPERUSER (deve ser NOSUPERUSER).');
    if (/(?<!NO)BYPASSRLS/i.test(seg)) failures.push('migration: unificard_app com BYPASSRLS (deve ser NOBYPASSRLS).');
  }
  // nunca conceder BYPASSRLS/superuser via ALTER/GRANT à app role
  if (/GRANT[\s\S]*?unificard_infra[\s\S]*?TO\s+unificard_app/i.test(sql)) failures.push('migration: unificard_app recebe unificard_infra (ganharia bypass) — proibido.');

  // RLS + FORCE + policy tenant-scoped por tabela financeira.
  for (const t of FINANCIAL_TABLES) {
    if (!new RegExp(`ALTER TABLE\\s+${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i').test(sql)) failures.push(`migration: ${t} sem ENABLE ROW LEVEL SECURITY.`);
    if (!new RegExp(`ALTER TABLE\\s+${t}\\s+FORCE ROW LEVEL SECURITY`, 'i').test(sql)) failures.push(`migration: ${t} sem FORCE ROW LEVEL SECURITY.`);
    if (!new RegExp(`CREATE POLICY[\\s\\S]*?ON\\s+${t}[\\s\\S]*?current_setting\\('app\\.current_tenant'`, 'i').test(sql)) {
      failures.push(`migration: ${t} sem policy tenant-scoped (current_setting('app.current_tenant')).`);
    }
  }

  // USING (true) só é permitido em policies de infra bypass (TO unificard_infra).
  for (const m of sql.matchAll(/CREATE POLICY[\s\S]*?(?=CREATE POLICY|ALTER TABLE|END \$\$|$)/gi)) {
    const stmt = m[0];
    if (/USING\s*\(\s*true\s*\)/i.test(stmt) && !/TO\s+unificard_infra/i.test(stmt)) {
      failures.push('migration: policy USING(true) não restrita a unificard_infra — proibido em tabela financeira.');
    }
  }

  // não relaxar RLS: sem DISABLE / sem row_security=off (ativo, fora de comentário).
  if (/DISABLE ROW LEVEL SECURITY/i.test(sql)) failures.push('migration: contém DISABLE ROW LEVEL SECURITY ativo — proibido.');
  if (/row_security\s*=\s*off/i.test(sql)) failures.push('migration: contém SET row_security=off — proibido.');
  for (const bt of BANK_TABLES) {
    if (new RegExp(`${bt}[^\\n]*DISABLE ROW LEVEL SECURITY`, 'i').test(sql)) failures.push(`migration: relaxa RLS de ${bt} — proibido.`);
  }
}

// ── pre-flight module ─────────────────────────────────────────────────────────
if (!existsSync(PREFLIGHT)) {
  failures.push('src/core/database/db-role-rls-preflight.ts ausente — pre-flight fail-closed não materializado.');
} else {
  const code = readFileSync(PREFLIGHT, 'utf-8');
  if (!/pg_roles/.test(code)) failures.push('pre-flight: não consulta pg_roles.');
  if (!/rolsuper/.test(code)) failures.push('pre-flight: não checa rolsuper.');
  if (!/rolbypassrls/.test(code)) failures.push('pre-flight: não checa rolbypassrls.');
  if (!/assertSecureDbRoleForMoneyRuntime/.test(code)) failures.push('pre-flight: não exporta assertSecureDbRoleForMoneyRuntime.');
  if (!/DB_ROLE_IS_SUPERUSER/.test(code)) failures.push('pre-flight: sem código DB_ROLE_IS_SUPERUSER.');
  if (!/DB_ROLE_BYPASSRLS/.test(code)) failures.push('pre-flight: sem código DB_ROLE_BYPASSRLS.');
  if (!/NODE_ENV\s*===\s*'production'|isProduction/.test(code)) failures.push('pre-flight: sem fail-closed específico de produção.');
}

// ── wiring no boot ─────────────────────────────────────────────────────────────
if (!existsSync(BOOT)) {
  failures.push('BOOT.ts ausente — não foi possível verificar wiring do pre-flight.');
} else {
  const boot = readFileSync(BOOT, 'utf-8');
  if (!/runDbRoleRlsPreflight\s*\(/.test(boot)) failures.push('BOOT.ts: pre-flight runDbRoleRlsPreflight não está wired no boot.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [db-role-rls-hardening]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [db-role-rls-hardening] — app role unificard_app NOSUPERUSER/NOBYPASSRLS; RLS+FORCE+policy tenant-scoped nas 7 tabelas payout/approval/recovery (sem USING(true) app-facing, sem DISABLE/row_security=off, bank_* não relaxado); pre-flight fail-closed presente e wired no boot.');
