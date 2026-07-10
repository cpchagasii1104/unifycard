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

// ── SINK (DT-CHECKOUT-FINANCIAL-GATE-AT-CALLER-NOT-SINK): gate NO sink de evento, ANTES da escrita bank_* ──
// Fecha por construção: mesmo um caller futuro/dead-code religado bate no gate antes de createTransactionWithSplit.
const BI = 'src/modules/bank/bank-integration.service.ts';
const bi = read(BI);
if (bi === null) fails.push(`arquivo ausente: ${BI}`);
else {
  for (const m of ['processEventTicketPayment', 'processEventConsumptionPayment']) {
    const start = bi.indexOf(`async ${m}(`);
    if (start === -1) { fails.push(`${BI}: método-sink ${m} ausente.`); continue; }
    const rest = bi.slice(start + 1);
    const nextAsync = rest.indexOf('\n  async ');
    const body = nextAsync === -1 ? rest : rest.slice(0, nextAsync);
    const g = body.search(/assertCheckoutFinancialRuntimeEnabled\(/);
    const b = body.search(/createTransactionWithSplit\(/);
    // Reconciliação F-BANK-SPLIT-PIPELINE-CONSOLIDATION Fase 1D: o sink pode estar (a) VIVO gated com o
    // firewall ANTES da escrita, OU (b) APOSENTADO com EVENT_*_PAYMENT_RETIRED (501 permanente, sem
    // alcançar createTransactionWithSplit — contenção MAIS FORTE). Falha se sem gate nem RETIRED, ou se
    // houver caminho VIVO ao split sem firewall. (read() já é comment-stripped — comentário não é prova.)
    const retiredCode = m === 'processEventTicketPayment' ? 'EVENT_TICKET_PAYMENT_RETIRED' : 'EVENT_CONSUMPTION_PAYMENT_RETIRED';
    const isRetired = body.includes(retiredCode);
    if (isRetired && b === -1) {
      // aposentado e sem caminho ao sink → contido (mais forte que o firewall); passa.
    } else if (g === -1) {
      fails.push(`${BI}: sink ${m} SEM gate fail-closed E SEM ${retiredCode} — sink financeiro desprotegido (ou caminho vivo ao split sem firewall).`);
    } else if (b !== -1 && g > b) {
      fails.push(`${BI}: sink ${m} com gate DEPOIS da escrita bank_* (createTransactionWithSplit).`);
    }
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [checkout-financial-containment]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [checkout-financial-containment] — runtime financeiro de checkout/eventos contido fail-closed (CHECKOUT_FINANCIAL_RUNTIME_ENABLED default OFF) no CALLER (CheckoutService/eventEconomyService) E no SINK (bankIntegration.processEvent{Ticket,Consumption}Payment, antes de createTransactionWithSplit) — defesa-em-profundidade; separado do SERVICE_FINANCIAL_RUNTIME_ENABLED; createTransactionWithSplit genérico intocado.');
