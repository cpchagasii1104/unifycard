#!/usr/bin/env node
// Guard estrutural — F-NOMENCLATURE-SERVICE-PAYMENT-AMOUNT-CENTS.
// Nomenclatura financeira canônica (07_NOMENCLATURA_CANONICA §valores monetários): dinheiro = inteiro
// em centavos, sufixo OBRIGATÓRIO `_cents`, tipo BIGINT, NUNCA NUMERIC/float. A migration
// 20260616220000 renomeou service_payment_requests.amount / service_payment_executions.amount → amount_cents.
//
// MORDE se a nomenclatura antiga voltar:
//   1/2. coluna bare `amount <tipo>` (re)definida em service_payment_requests/executions (migration nova);
//   3.   `amount AS "amountCents"` nos repositories dessas tabelas;
//   4/5. INSERT INTO service_payment_(requests|executions) usando coluna bare `amount`;
//   6.   CHECK monetário `amount > 0` (bare) nessas tabelas;
//   7.   `amount_cents NUMERIC/DECIMAL/float` (tipo proibido) nessas tabelas.
// ACEITA: amount_cents BIGINT · amount_cents > 0 · amount_cents AS "amountCents".
// Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'migrations');

const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Arquivos onde `amount` (pré-rename) aparece LEGITIMAMENTE: os CREATE históricos (imutáveis,
// forward-only) e a própria migration de rename. Qualquer OUTRA migration que (re)introduza bare
// `amount` nessas tabelas é regressão.
const MIGRATION_ALLOWLIST = new Set([
  '20260530494000_create_service_booking_decisions_and_payment_requests.sql',
  '20260530514000_create_service_payment_executions.sql',
  '20260616220000_rename_service_payment_amount_to_amount_cents.sql',
]);

const RENAME_MIGRATION = '20260616220000_rename_service_payment_amount_to_amount_cents.sql';

const REPOS = [
  'src/modules/services/service-payment-request.repository.ts',
  'src/modules/services/service-payment-execution.repository.ts',
];

const failures = [];

// ── Migrations ────────────────────────────────────────────────────────────────
if (!existsSync(join(MIGRATIONS_DIR, RENAME_MIGRATION))) {
  failures.push(`migration de rename ausente: ${RENAME_MIGRATION} — a correção de nomenclatura precisa existir.`);
}

for (const file of readdirSync(MIGRATIONS_DIR)) {
  if (!file.endsWith('.sql')) continue;
  if (MIGRATION_ALLOWLIST.has(file)) continue;
  const sql = stripSql(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
  if (!/service_payment_(requests|executions)/i.test(sql)) continue;

  // 1/2 — bare `amount <tipo monetário>` (re)definida.
  if (/\bamount\s+(BIGINT|NUMERIC|INTEGER|DECIMAL|REAL|DOUBLE|FLOAT)/i.test(sql)) {
    failures.push(`${file}: coluna monetária bare \`amount\` (re)definida em service_payment_* — use amount_cents BIGINT (07 §_cents).`);
  }
  // 6 — CHECK monetário bare `amount > 0`.
  if (/CHECK\s*\(\s*amount\s*>/i.test(sql)) {
    failures.push(`${file}: CHECK \`amount > 0\` bare em service_payment_* — deve ser amount_cents > 0.`);
  }
  // 7 — tipo proibido em amount_cents.
  if (/\bamount_cents\s+(NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT)/i.test(sql)) {
    failures.push(`${file}: amount_cents com tipo NUMERIC/float em service_payment_* — dinheiro é BIGINT (07 §_cents).`);
  }
}

// ── Repositories ──────────────────────────────────────────────────────────────
for (const rel of REPOS) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`repository ausente: ${rel}.`); continue; }
  const code = stripTs(readFileSync(p, 'utf-8'));

  // Positivo — a borda do mapper usa a coluna real aliasada.
  if (!/amount_cents\s+AS\s+"amountCents"/.test(code)) {
    failures.push(`${rel}: perdeu \`amount_cents AS "amountCents"\` — coluna real não lida na borda do mapper.`);
  }
  // 3 — alias de fachada sobre a coluna antiga.
  if (/\bamount\s+AS\s+"amountCents"/.test(code)) {
    failures.push(`${rel}: \`amount AS "amountCents"\` reintroduzido — coluna antiga; use amount_cents.`);
  }
  // 4/5 — INSERT com coluna bare `amount`.
  if (/INSERT\s+INTO\s+service_payment_requests[\s\S]{0,200}?\bamount\b/i.test(code)) {
    failures.push(`${rel}: INSERT INTO service_payment_requests usando coluna bare \`amount\` — deve gravar amount_cents.`);
  }
  if (/INSERT\s+INTO\s+service_payment_executions[\s\S]{0,200}?\bamount\b/i.test(code)) {
    failures.push(`${rel}: INSERT INTO service_payment_executions usando coluna bare \`amount\` — deve gravar amount_cents.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-payment-amount-cents]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [service-payment-amount-cents]');
