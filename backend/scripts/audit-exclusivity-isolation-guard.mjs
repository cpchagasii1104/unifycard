#!/usr/bin/env node
// audit-exclusivity-isolation-guard.mjs — DECISION-0189B D8 GUARD
//
// Trava estrutural: a migration da guarda de isolamento existe e AMBOS os trigger functions
// rejeitam REPEATABLE READ / isolamento não suportado (fail-closed) ANTES de adquirir o lock.
// Remover a guarda (voltar a confiar cegamente no recheck) MORDE.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (m) => { console.error(`❌ [audit-exclusivity-isolation-guard] ${m}`); process.exit(1); };

const MIG = 'migrations/20260719220000_company_exclusivity_isolation_guard.sql';
if (!existsSync(join(ROOT, MIG))) fail(`migration da guarda de isolamento ausente: ${MIG}`);
const sql = readFileSync(join(ROOT, MIG), 'utf8');

// as duas trigger functions recriadas
for (const fn of ['fn_company_membership_delegation_exclusivity', 'fn_company_users_delegation_exclusivity']) {
  const idx = sql.indexOf(`FUNCTION ${fn}`);
  if (idx < 0) fail(`${fn} não recriada na migration da guarda`);
  const body = sql.slice(idx, sql.indexOf('$$;', idx));
  if (!/current_setting\('transaction_isolation'\)/.test(body)) fail(`${fn} não lê o nível de isolamento (D8)`);
  if (!/repeatable read/.test(body) || !/EXCLUSIVITY_UNSAFE_ISOLATION/.test(body)) fail(`${fn} não rejeita REPEATABLE READ fail-closed (D8)`);
  if (!/EXCLUSIVITY_UNKNOWN_ISOLATION/.test(body)) fail(`${fn} não rejeita isolamento desconhecido fail-closed (D8)`);
  // a guarda vem ANTES do lock (fail-closed antes de qualquer trabalho)
  const isoAt = body.indexOf('current_setting');
  const lockAt = body.indexOf('fn_company_relation_advisory_lock');
  if (isoAt < 0 || lockAt < 0 || isoAt > lockAt) fail(`${fn}: guarda de isolamento deve preceder o advisory lock (D8)`);
}

console.log('✅ audit-exclusivity-isolation-guard: ambos os triggers rejeitam RR/isolamento não suportado antes do lock (fail-closed D8).');
