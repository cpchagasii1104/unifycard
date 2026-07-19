#!/usr/bin/env node
// audit-reporting-risk-financial-hold.mjs — DECISION-0189C D5 GUARD
//
// Enquanto a PORTA 01 estiver fechada, reporting/risk NÃO projetam payouts/invoices:
//  1. todo service method de reporting/risk que chama listOrders/listInvoices tem barreira
//     assertFinancialProjectionAllowed ANTES da chamada;
//  2. toda ROTA que serve essas projeções responde 503 via isPorta01Closed (superfície inteira);
//  3. nenhum acesso SQL direto a payout/invoice contornando os services nessas superfícies;
//  4. a barreira NÃO é superada por permissão tenant-operator / fallback role/admin.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const fail = (m) => { console.error(`❌ [audit-reporting-risk-financial-hold] ${m}`); process.exit(1); };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// ── 1. services: barreira ANTES de listOrders/listInvoices ───────────────────
const services = [
  'src/modules/reporting/reporting.service.ts',
  'src/modules/risk-command-center/risk-dashboard.service.ts',
];
for (const f of services) {
  const src = read(f);
  // localizar cada chamada a listOrders/listInvoices e exigir a barreira antes, no mesmo método
  const callRe = /(listOrders|listInvoices)\s*\(/g;
  let m;
  while ((m = callRe.exec(src)) !== null) {
    // método que contém a chamada: recuar até o "async <nome>(" anterior
    const before = src.slice(0, m.index);
    const methodStart = Math.max(before.lastIndexOf('\n  async '), before.lastIndexOf('\n  private async '));
    if (methodStart < 0) fail(`${f}: chamada ${m[1]} fora de método reconhecível`);
    const methodBody = src.slice(methodStart, m.index);
    if (!/assertFinancialProjectionAllowed\s*\(\s*\)/.test(methodBody)) {
      fail(`${f}: ${m[1]} sem barreira assertFinancialProjectionAllowed no método (DECISION-0189C D5)`);
    }
  }
}

// ── 2. rotas: 503 via isPorta01Closed ────────────────────────────────────────
const routes = [
  ['src/modules/reporting/reporting.routes.ts', 1],
  ['src/modules/risk-command-center/risk-dashboard.routes.ts', 4],
];
for (const [f, minGuards] of routes) {
  const src = read(f);
  const guards = (src.match(/isPorta01Closed\(\)/g) || []).length;
  const held = (src.match(/FINANCIAL_PROJECTION_HELD_BODY/g) || []).length;
  if (guards < minGuards || held < minGuards) {
    fail(`${f}: rotas de projeção financeira sem 503 PORTA_01_CLOSED suficiente (${guards}/${held} < ${minGuards}) — DECISION-0189C D5`);
  }
}

// ── 3. sem SQL direto a payout/invoice nessas superfícies (contorno dos services) ─
for (const f of [...services, 'src/modules/reporting/reporting.routes.ts', 'src/modules/risk-command-center/risk-dashboard.routes.ts']) {
  const src = read(f);
  if (/FROM\s+payout_orders|FROM\s+invoices\b|INTO\s+payout_orders/i.test(src)) {
    fail(`${f}: SQL direto a payout/invoice contornando os services (DECISION-0189C D5)`);
  }
}

// ── 4. barreira estrutural (não superável por role/admin) ────────────────────
const holdModule = read('src/core/authorization/financial-projection-hold.ts');
if (!/isPorta01Closed/.test(holdModule) || !/assertFinancialProjectionAllowed/.test(holdModule)) {
  fail('financial-projection-hold perdeu a barreira estrutural (isPorta01Closed/assert).');
}

console.log('✅ audit-reporting-risk-financial-hold: reporting/risk não projetam payouts/invoices sob PORTA 01 (barreira de service + 503 de rota; sem SQL de contorno).');
