#!/usr/bin/env node
// Guard estrutural — F-NOMENCLATURE-SERVICE-MONEY-07-CLOSURE.
// Cerca de regressão para DINHEIRO·CURRENCY·STATUS do domínio de serviços (07_NOMENCLATURA_CANONICA):
//   §4.7  dinheiro = inteiro centavos, sufixo `_cents`, BIGINT (não INTEGER, nunca NUMERIC/float).
//   §4.10 currency = ISO 4217, VARCHAR(3); `FIC` NÃO é moeda canônica. Service payment MVP = BRL.
//   §3.4  `status` genérico isolado é proibido — service_payment_requests usa `payment_request_status`.
// A migration 20260616230000 renomeou status→payment_request_status, currency→VARCHAR(3) BRL (CHECK),
// service_payment_executions.currency TEXT→VARCHAR(3) BRL (CHECK), services.price_cents INTEGER→BIGINT.
//
// MORDE se a nomenclatura/tipo antigo voltar (migration nova OU runtime). ACEITA o estado canônico.
// Em validate:regression-guards. Complementa audit-service-payment-amount-cents.mjs (amount→amount_cents).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'migrations');

const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Migrations onde a nomenclatura/tipo PRÉ-07 aparece LEGITIMAMENTE: os CREATE históricos (imutáveis),
// a CHECK histórica de status, o rename de amount, e a própria migration desta frente.
const MIGRATION_ALLOWLIST = new Set([
  '20260418120000_services_table_core.sql',                                      // services: price_cents INTEGER + status TEXT (lifecycle) + currency VARCHAR(3)
  '20260530494000_create_service_booking_decisions_and_payment_requests.sql',    // spr: status VARCHAR(30), currency VARCHAR(10) 'FIC', amount
  '20260530514000_create_service_payment_executions.sql',                        // spe: currency TEXT, amount
  '20260530535000_c36_status_check_constraints.sql',                             // spr: CHECK (status IN ...) bare
  '20260616220000_rename_service_payment_amount_to_amount_cents.sql',            // amount → amount_cents
  '20260616230000_align_service_money_nomenclature_07.sql',                      // ESTA frente (status/currency/price_cents)
]);

const THIS_MIGRATION = '20260616230000_align_service_money_nomenclature_07.sql';

const failures = [];

// ── Migrations ──────────────────────────────────────────────────────────────────────────────
if (!existsSync(join(MIGRATIONS_DIR, THIS_MIGRATION))) {
  failures.push(`migration de alinhamento ausente: ${THIS_MIGRATION} — a correção 07 precisa existir.`);
}

for (const file of readdirSync(MIGRATIONS_DIR)) {
  if (!file.endsWith('.sql')) continue;
  if (MIGRATION_ALLOWLIST.has(file)) continue;
  const sql = stripSql(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));

  const touchesServicePayment = /service_payment_(requests|executions)/i.test(sql);
  const touchesServices = /\bservices\b/i.test(sql);

  if (touchesServicePayment) {
    // FIC default reintroduzido (FIC não é ISO 4217 — 07 §4.10).
    if (/DEFAULT\s+'FIC'/i.test(sql)) {
      failures.push(`${file}: DEFAULT 'FIC' em service_payment_* — FIC não é moeda canônica; use 'BRL' (07 §4.10).`);
    }
    // currency com tipo não-canônico (TEXT ou VARCHAR(n≠3)).
    if (/currency\s+TEXT\b/i.test(sql) || /currency\s+VARCHAR\s*\(\s*(?!3\s*\))\d+\s*\)/i.test(sql)) {
      failures.push(`${file}: currency TEXT/VARCHAR(n≠3) em service_payment_* — currency é VARCHAR(3) ISO 4217 (07 §4.10).`);
    }
    // status genérico (re)definido como coluna em service_payment_*.
    if (/\bstatus\s+(VARCHAR|TEXT|CHAR|ENUM)/i.test(sql)) {
      failures.push(`${file}: coluna genérica \`status\` (re)definida em service_payment_* — use payment_request_status (07 §3.4).`);
    }
    // CHECK bare sobre `status` (deve ser payment_request_status).
    if (/CHECK\s*\(\s*status\s+IN/i.test(sql)) {
      failures.push(`${file}: CHECK (status IN ...) bare em service_payment_* — deve referenciar payment_request_status.`);
    }
    // money bare `amount` ou amount_cents com tipo proibido (inclui INTEGER — dinheiro é BIGINT).
    if (/\bamount\s+(BIGINT|NUMERIC|INTEGER|DECIMAL|REAL|DOUBLE|FLOAT)/i.test(sql)) {
      failures.push(`${file}: coluna monetária bare \`amount\` em service_payment_* — use amount_cents BIGINT (07 §4.7).`);
    }
    if (/\bamount_cents\s+(NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT|INTEGER)/i.test(sql)) {
      failures.push(`${file}: amount_cents com tipo não-BIGINT em service_payment_* — dinheiro é BIGINT (07 §4.7).`);
    }
  }

  if (touchesServices) {
    // services money: price_cents deve nascer BIGINT, nunca INTEGER/NUMERIC/float (07 §4.7).
    if (/price_cents\s+(INTEGER|NUMERIC|DECIMAL|REAL|DOUBLE|FLOAT)\b/i.test(sql)) {
      failures.push(`${file}: services.price_cents com tipo não-BIGINT — dinheiro é BIGINT, não INTEGER (07 §4.7).`);
    }
  }
}

// ── Runtime ─────────────────────────────────────────────────────────────────────────────────
const checkFile = (rel, { requires = [], forbids = [] }) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}.`); return; }
  const code = stripTs(readFileSync(p, 'utf-8'));
  for (const { re, msg } of requires) {
    if (!re.test(code)) failures.push(`${rel}: ${msg}`);
  }
  for (const { re, msg } of forbids) {
    if (re.test(code)) failures.push(`${rel}: ${msg}`);
  }
};

const FIC = { re: /'FIC'/, msg: "literal 'FIC' no caminho service_payment — FIC não é moeda canônica; use 'BRL' (07 §4.10)." };

checkFile('src/modules/services/service-payment-request.types.ts', {
  requires: [{ re: /paymentRequestStatus/, msg: 'perdeu o campo canônico paymentRequestStatus (07 §3.4).' }],
  forbids: [FIC],
});
checkFile('src/modules/services/service-payment-request.repository.ts', {
  requires: [{ re: /payment_request_status\s+AS\s+"paymentRequestStatus"/, msg: 'perdeu `payment_request_status AS "paymentRequestStatus"` — coluna canônica não lida na borda.' }],
  forbids: [
    FIC,
    { re: /\bstatus\s+AS\s+"paymentRequestStatus"/, msg: '`status AS "paymentRequestStatus"` — coluna antiga; use payment_request_status.' },
    { re: /\bstatus\s*,\s*amount_cents\b/, msg: 'coluna bare `status` em lista SQL de service_payment_requests — use payment_request_status (07 §3.4).' },
  ],
});
checkFile('src/modules/services/service-payment-request.service.ts', { forbids: [FIC] });
checkFile('src/modules/services/service-payment-request.routes.ts', { forbids: [FIC] });
checkFile('src/modules/services/service-payment-execution.types.ts', { forbids: [FIC] });
checkFile('src/core/profile/pending-responsibilities.routes.ts', {
  requires: [{ re: /payment_request_status/, msg: 'perdeu payment_request_status na leitura de service_payment_requests (07 §3.4).' }],
  forbids: [{ re: /\bpr\.status\b/, msg: 'acesso bare `pr.status` — coluna é payment_request_status (07 §3.4).' }],
});
checkFile('src/core/profile/impact-overview.routes.ts', {
  requires: [{ re: /payment_request_status/, msg: 'perdeu payment_request_status no filtro de service_payment_requests (07 §3.4).' }],
});
// services money: a coerção BIGINT-safe do mapper preserva priceCents:number após o widening.
checkFile('src/modules/services/services.repository.ts', {
  requires: [{ re: /Number\(row\.price_cents\)/, msg: 'perdeu a coerção Number(row.price_cents) — BIGINT volta como string no pg (07 §4.7).' }],
});

if (failures.length > 0) {
  console.error('GATE FAIL [service-money-07-nomenclature]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('GATE OK [service-money-07-nomenclature]');
