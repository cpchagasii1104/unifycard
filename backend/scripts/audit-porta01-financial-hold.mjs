#!/usr/bin/env node
// audit-porta01-financial-hold.mjs — DECISION-0189B (C1 / D1–D3) GUARD
//
// INVARIANTES enquanto a PORTA 01 estiver fechada:
//  1. As chaves monetárias MUTANTES vivas estão TODAS em PORTA_HOLD_KEYS (execute_payout,
//     execute_payments, execute_payouts, manage_splits, split:create) + a leitura consolidada
//     view_all_ledger. Remover qualquer uma MORDE.
//  2. GET /payouts/orders NÃO chama payoutService.listOrders no caminho vivo e responde
//     503 PORTA_01_CLOSED. Reintroduzir listOrders ou o preHandler de execute_payout MORDE.
//  3. Nenhuma rota GET reusa uma chave execute/manage de dinheiro como permissão de LEITURA.
//  4. A contenção de settlement/region-account/payout-exec NÃO pode ficar só num comentário
//     "disabled": o retorno 403/503 estrutural precisa existir junto do código contido.

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (msg) => { console.error(`❌ [audit-porta01-financial-hold] ${msg}`); process.exit(1); };

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const walkTs = (dir, acc = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walkTs(rel, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) acc.push(rel);
  }
  return acc;
};

// ── Invariante 1: HOLD exaustivo ──────────────────────────────────────────────
const registry = read('src/core/authorization/company-policy-registry.ts');
const holdBlock = registry.match(/PORTA_HOLD_KEYS\s*:\s*readonly\s+PermissionKey\[\]\s*=\s*\[([\s\S]*?)\];/);
if (!holdBlock) fail('PORTA_HOLD_KEYS não encontrado no registry.');
const REQUIRED_HOLD = [
  'financial:view_all_ledger',
  'marketplace_execute_payouts',
  'marketplace_manage_splits',
  'financial:execute_payout',
  'marketplace_execute_payments',
  'split:create',
  'financial_terms:confirm', // 0189C D1 — writer de bank_splits
];
for (const k of REQUIRED_HOLD) {
  if (!new RegExp(`['"]${k.replace(/[:]/g, '\\$&')}['"]`).test(holdBlock[1])) {
    fail(`Chave monetária "${k}" FORA de PORTA_HOLD_KEYS (DECISION-0189B D3) — PORTA 01 abriria fresta.`);
  }
}

// ── Invariante 2 + 3: GET /payouts/orders desativado ─────────────────────────
const payoutRoutes = read('src/modules/payout/payout.routes.ts');
const ordersRoute = payoutRoutes.match(/'\/payouts\/orders'[\s\S]*?\}\);/);
if (!ordersRoute) fail("Rota '/payouts/orders' não localizada.");
if (/listOrders/.test(ordersRoute[0])) {
  fail("GET /payouts/orders voltou a chamar payoutService.listOrders no caminho vivo (DECISION-0189B D2).");
}
if (/requirePayoutPermission/.test(ordersRoute[0])) {
  fail("GET /payouts/orders reusa financial:execute_payout como permissão de leitura (DECISION-0189B D2).");
}
if (!/PORTA_01_CLOSED/.test(ordersRoute[0]) || !/503/.test(ordersRoute[0])) {
  fail("GET /payouts/orders não retorna 503 PORTA_01_CLOSED (DECISION-0189B D2).");
}

// ── Invariante 4: contenção estrutural, não só comentário ────────────────────
const structuralContained = [
  ['src/modules/marketplace/settlement.routes.ts', /reply\.status\(403\)\.send\(SETTLEMENT_HTTP_EXECUTION_DISABLED\)/],
  ['src/modules/marketplace/settlement.routes.ts', /reply\.status\(403\)\.send\(REGION_ACCOUNT_HTTP_EXECUTION_DISABLED\)/],
  ['src/modules/payout/payout.routes.ts', /reply\.status\(403\)\.send\(PAYOUT_HTTP_EXECUTION_DISABLED\)/],
];
for (const [file, re] of structuralContained) {
  if (!re.test(read(file))) {
    fail(`${file}: contenção financeira perdeu o retorno estrutural (403) — comentário "disabled" não basta (DECISION-0189B).`);
  }
}

// ── Invariante 5 (D7): invoices porta de ativação fechada por default ────────
const invoiceActivation = read('src/modules/invoicing/invoice-activation.ts');
if (!/export const INVOICES_ACTIVATED\s*=\s*false\b/.test(invoiceActivation)) {
  fail('INVOICES_ACTIVATED não é `false` literal (DECISION-0189B D7) — porta de invoices abriria.');
}
if (/to_regclass\s*\(|information_schema\.|pg_tables\b/.test(invoiceActivation)) {
  fail('invoice-activation deriva ativação de existência de schema (DECISION-0189B D7 proíbe) — porta deve ser explícita.');
}
const invoiceRoutes = read('src/modules/invoicing/invoice.routes.ts');
const preHandlers = invoiceRoutes.match(/preHandler:\s*\[[^\]]*\]/g) || [];
if (preHandlers.length === 0) fail('invoice.routes sem preHandler com gate de ativação.');
for (const ph of preHandlers) {
  if (!/\bgate\b/.test(ph)) fail(`invoice.routes: rota sem gate de ativação no preHandler (${ph}) — DECISION-0189B D7.`);
}

// ── Invariante 6 (D6): economic-overview não vaza e responde 503 sanitizado ──
const overviewRoutes = read('src/modules/economy/economic-overview.routes.ts');
if (/message:\s*error instanceof Error/.test(overviewRoutes)) {
  fail('economic-overview vaza error.message no corpo (DECISION-0189B D6) — usar OVERVIEW_UNAVAILABLE_BODY.');
}
if (/\.status\(500\)/.test(overviewRoutes)) {
  fail('economic-overview ainda responde 500 (DECISION-0189B D6 exige 503 sanitizado).');
}
if (!/OVERVIEW_UNAVAILABLE_BODY/.test(overviewRoutes) || !/overviewDependenciesAvailable/.test(overviewRoutes)) {
  fail('economic-overview não usa preflight de dependências + corpo sanitizado (DECISION-0189B D6).');
}

// ── Invariante 7 (0189C D2): barreira de service em confirmFinancialTerms ────
const svcOrder = read('src/modules/services/service-order.service.ts');
const confirmIdx = svcOrder.indexOf('async confirmFinancialTerms');
if (confirmIdx < 0) fail('confirmFinancialTerms não encontrado (writer de split).');
const firstSplit = svcOrder.indexOf('createSplit', confirmIdx);
const barrier = svcOrder.indexOf('isPorta01Closed', confirmIdx);
if (barrier < 0) fail('confirmFinancialTerms sem barreira isPorta01Closed (DECISION-0189C D2).');
if (firstSplit >= 0 && barrier > firstSplit) fail('barreira isPorta01Closed DEPOIS do createSplit (deve preceder — D2).');
// a barreira NÃO pode depender de feature flag como autoridade (ignora menção em comentário)
const barrierWindow = svcOrder.slice(confirmIdx, barrier + 200)
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
if (/FEATURE_FINANCIAL_ENABLED/.test(barrierWindow)) {
  fail('barreira de confirmFinancialTerms consulta FEATURE_FINANCIAL_ENABLED — flag não é autoridade (D2).');
}
if (!(new RegExp("isPorta01Closed").test(read('src/core/authorization/company-policy-registry.ts')))) {
  fail('isPorta01Closed removido do registry (estado estrutural da PORTA 01).');
}

// ── Invariante 8 (0189C D3): nenhum caller NOVO de createSplit fora do Bank/HOLD ─
// callers vivos permitidos de bankSplitRepository.createSplit: bank core + confirmFinancialTerms
// (agora barrado). paymentSplitRepository é Proxy morto (ghost). Novo caller MORDE.
const CREATE_SPLIT_ALLOW = new Set([
  'src/modules/bank/bank-transaction.service.ts',
  'src/modules/services/service-order.service.ts',
]);
for (const f of walkTs('src')) {
  const src = read(f);
  if (/bankSplitRepository\.createSplit\(/.test(src) && !CREATE_SPLIT_ALLOW.has(f)) {
    fail(`${f}: novo caller de bankSplitRepository.createSplit fora do núcleo Bank/HOLD (DECISION-0189C D3)`);
  }
}

// ── Invariante 9 (0189C D8): receive_funds sem caller runtime ────────────────
for (const f of walkTs('src')) {
  if (/company-policy-registry|permission-keys|business-permissions/.test(f)) continue;
  const src = read(f);
  if (/requirePermission\(\s*['"]receive_funds['"]|canActAs\([^)]*['"]receive_funds['"]|canPerformAction\([^)]*['"]receive_funds['"]/.test(src)) {
    fail(`${f}: caller runtime de receive_funds sem decisão normativa (DECISION-0189C D8)`);
  }
}

console.log('✅ audit-porta01-financial-hold: HOLD monetário exaustivo (+financial_terms:confirm); /payouts/orders 503; invoices porta fechada; overview 503 sanitizado; barreira de split em confirmFinancialTerms; sem novo caller createSplit/receive_funds.');
