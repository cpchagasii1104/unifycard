#!/usr/bin/env node
// Guard estrutural — F-VENUE-PAY-MONEY-HOLD-CONTAINMENT (achado da verificação de V3 do parecer
// sobre a re-auditoria Yala, 2026-07-05).
//
// POST /t/:qrToken/orders/:orderId/pay é rota PÚBLICA (sem auth) que alcançava
// paymentExecutionService.executePayment sem NENHUM firewall default-off — diferente do PDV
// (mesmo sink), que já tinha assertPdvFinancialRuntimeEnabled. Corrigido: mesmo padrão,
// assertVenueFinancialRuntimeEnabled como PRIMEIRA instrução do handler.
//
// MORDE se o assert sumir, ou se createPaymentIntent/executePayment ficarem alcançáveis antes
// dele. Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FIREWALL_FILE = join(ROOT, 'src', 'modules', 'venue', 'venue-financial-firewall.ts');
const ROUTES_FILE = join(ROOT, 'src', 'modules', 'venue', 'venue.routes.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

if (!existsSync(FIREWALL_FILE)) {
  failures.push(`arquivo ausente: ${FIREWALL_FILE}`);
} else {
  const src = stripTs(readFileSync(FIREWALL_FILE, 'utf8'));
  if (!/VENUE_FINANCIAL_RUNTIME_ENABLED/.test(src)) {
    failures.push(`${FIREWALL_FILE}: flag VENUE_FINANCIAL_RUNTIME_ENABLED ausente.`);
  }
  if (!/=== 'true'/.test(src)) {
    failures.push(`${FIREWALL_FILE}: isVenueFinancialRuntimeEnabled não compara estritamente com 'true' — risco de fail-open.`);
  }
}

if (!existsSync(ROUTES_FILE)) {
  failures.push(`arquivo ausente: ${ROUTES_FILE}`);
} else {
  const src = stripTs(readFileSync(ROUTES_FILE, 'utf8'));
  const routeStart = src.indexOf("'/t/:qrToken/orders/:orderId/pay'");
  if (routeStart < 0) {
    failures.push(`${ROUTES_FILE}: rota /pay não encontrada.`);
  } else {
    const nextRoute = src.indexOf("fastify.", routeStart + 40);
    const scope = src.slice(routeStart, nextRoute >= 0 ? nextRoute : undefined);
    const assertIdx = scope.indexOf('assertVenueFinancialRuntimeEnabled(');
    const intentIdx = scope.indexOf('createPaymentIntent(');
    const execIdx = scope.indexOf('executePayment(');
    if (assertIdx < 0) {
      failures.push(`${ROUTES_FILE}: assertVenueFinancialRuntimeEnabled ausente na rota /pay — contenção removida.`);
    }
    if (intentIdx >= 0 && (assertIdx < 0 || intentIdx < assertIdx)) {
      failures.push(`${ROUTES_FILE}: createPaymentIntent fica ANTES (ou sem) o assert de contenção.`);
    }
    if (execIdx >= 0 && (assertIdx < 0 || execIdx < assertIdx)) {
      failures.push(`${ROUTES_FILE}: executePayment fica ANTES (ou sem) o assert de contenção.`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [venue-pay-money-hold-containment]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [venue-pay-money-hold-containment] — POST /t/:qrToken/orders/:orderId/pay exige VENUE_FINANCIAL_RUNTIME_ENABLED=true ANTES de qualquer side-effect financeiro; default OFF.');
