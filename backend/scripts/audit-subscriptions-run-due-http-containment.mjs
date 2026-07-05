#!/usr/bin/env node
// Guard estrutural — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT, superfície subscriptions
// (achado da verificação de V3 do parecer sobre a re-auditoria Yala, 2026-07-05).
//
// POST /subscriptions/run-due tinha comentário "admin/internal" mas ZERO checagem de auth —
// runDueSubscriptions -> executeSubscriptionAction -> paymentExecutionService.executePayment
// cai no branch REAL de movimentação (nunca seta payment_method_snapshot). Mesmo padrão de
// automation/schedule/run-due (F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT) replicado: 403
// fail-closed, nenhum caller alcança runDueSubscriptions por HTTP.
//
// MORDE se a rota voltar a chamar runDueSubscriptions diretamente, ou se o 403 sumir.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'modules', 'subscriptions', 'subscription.routes.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));
  const routeStart = src.indexOf("'/run-due'");
  if (routeStart < 0) {
    failures.push(`${FILE}: rota /run-due não encontrada.`);
  } else {
    const nextRoute = src.indexOf("fastify.", routeStart + 20);
    const scope = src.slice(routeStart, nextRoute >= 0 ? nextRoute : undefined);
    if (!/SUBSCRIPTIONS_RUN_DUE_HTTP_DISABLED/.test(scope)) {
      failures.push(`${FILE}: código SUBSCRIPTIONS_RUN_DUE_HTTP_DISABLED ausente — contenção removida.`);
    }
    if (!/status\(403\)/.test(scope)) {
      failures.push(`${FILE}: rota /run-due não retorna 403 — contenção removida.`);
    }
    if (/subscriptionService\.runDueSubscriptions\(/.test(scope)) {
      failures.push(`${FILE}: rota /run-due volta a chamar runDueSubscriptions diretamente — reabre o financial hole.`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [subscriptions-run-due-http-containment]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [subscriptions-run-due-http-containment] — POST /subscriptions/run-due fail-closed 403; runDueSubscriptions inalcançável por HTTP.');
