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

console.log('✅ audit-porta01-financial-hold: HOLD monetário exaustivo; /payouts/orders 503; contenção estrutural viva.');
