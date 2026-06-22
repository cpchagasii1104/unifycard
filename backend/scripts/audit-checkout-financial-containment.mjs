#!/usr/bin/env node
// Guard estrutural — F-CHECKOUT-FINANCIAL-RUNTIME-CONTAINMENT.
//
// Garante que o runtime financeiro de checkout/eventos está contido fail-closed (default OFF) ANTES de
// qualquer mock de cobrança / chamada a bank-integration. MORDE se: o gate sair de processCheckout
// (CheckoutService OU eventEconomyService); o gate vier DEPOIS da delegação ao banco; o flag deixar de ser
// default-OFF; ou o firewall for confundido com SERVICE_FINANCIAL_RUNTIME_ENABLED. Estático, comment-stripped.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const fails = [];
const need = (src, file, re, why) => { if (!re.test(src)) fails.push(`${file}: ${why}`); };
// gate ANTES do banco: índice do assert < índice da 1ª delegação a bank-integration
const before = (src, file, gateRe, bankRe, why) => {
  const g = src.search(gateRe), b = src.search(bankRe);
  if (g === -1) { fails.push(`${file}: ${why} (gate ausente)`); return; }
  if (b !== -1 && g > b) fails.push(`${file}: ${why} (gate DEPOIS da delegação ao banco)`);
};

// ── firewall ──
const FW = 'src/core/checkout/checkout-financial-firewall.ts';
const fw = read(FW);
if (fw === null) fails.push(`arquivo ausente: ${FW}`);
else {
  need(fw, FW, /CHECKOUT_FINANCIAL_RUNTIME_ENABLED/, 'flag CHECKOUT_FINANCIAL_RUNTIME_ENABLED ausente.');
  need(fw, FW, /===\s*'true'/, 'flag não é default-OFF (deve ligar SÓ com === \'true\').');
  need(fw, FW, /CHECKOUT_FINANCIAL_RUNTIME_DISABLED/, 'erro honesto CHECKOUT_FINANCIAL_RUNTIME_DISABLED ausente.');
  if (/SERVICE_FINANCIAL_RUNTIME_ENABLED/.test(fw)) fails.push(`${FW}: NÃO conflacionar com SERVICE_FINANCIAL_RUNTIME_ENABLED (trilhos separados).`);
}

// ── choke point 1: CheckoutService.processCheckout ──
const CS = 'src/core/checkout/CheckoutService.ts';
const cs = read(CS);
if (cs === null) fails.push(`arquivo ausente: ${CS}`);
else before(cs, CS, /assertCheckoutFinancialRuntimeEnabled\(/, /bankIntegration|processEvent\w+Payment|mockUnifyCardCharge/,
  'processCheckout sem gate fail-closed antes do mock/bank');

// ── choke point 2: eventEconomyService.processCheckout ──
const EE = 'src/core/events/event-economy.service.ts';
const ee = read(EE);
if (ee === null) fails.push(`arquivo ausente: ${EE}`);
else before(ee, EE, /assertCheckoutFinancialRuntimeEnabled\(/, /bankIntegration|processEvent\w+Payment/,
  'processCheckout (event-economy) sem gate fail-closed antes da delegação ao banco');

if (fails.length > 0) {
  console.error('GATE FAIL [checkout-financial-containment]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [checkout-financial-containment] — runtime financeiro de checkout/eventos contido fail-closed (CHECKOUT_FINANCIAL_RUNTIME_ENABLED default OFF) ANTES de mock/bank em CheckoutService.processCheckout e eventEconomyService.processCheckout; separado do SERVICE_FINANCIAL_RUNTIME_ENABLED.');
