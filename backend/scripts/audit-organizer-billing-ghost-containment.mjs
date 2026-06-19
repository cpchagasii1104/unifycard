#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8K (organizers billing/subscription SCHEMA-GHOST containment; DECISION-0113 / Z2).
//
// O substrato de billing do organizer é schema-ghost (event_organizers.plan/plan_expires_at ausentes; colunas de
// organizer_subscriptions escritas por organizer-billing.service inexistentes). As rotas de subscription/billing
// foram contidas: 501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED (subscribe/cancel/subscribe-stripe/plan/subscription)
// + webhook no-op ACK 200 (sem ghost-write, sem retry storm). MORDE se: alguma rota de billing voltar a chamar
// organizerBillingService/stripeService; o webhook voltar a despachar handlers/escrever; reaparecer leitura/escrita
// das colunas ghost (plan/plan_expires_at, payment_gateway*, current_period_*); sumir o code de contenção; OU se
// event-settlement canônico (events.actor_id + canRepresentActor) for tocado. Comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/events/organizers/organizers.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [organizer-billing-ghost-containment]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) code de contenção presente.
if (!/ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED/.test(code)) {
  failures.push(`${REL}: perdeu o code ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED.`);
}
// 2) billing service e stripe service NÃO podem ser chamados das rotas (contidas antes de qualquer sink).
if (/organizerBillingService\s*\./.test(code)) {
  failures.push(`${REL}: voltou a chamar organizerBillingService — billing schema-ghost deve ficar contido (501) antes de qualquer service.`);
}
if (/stripeService\s*\./.test(code)) {
  failures.push(`${REL}: voltou a chamar stripeService — subscribe/stripe e webhook estão contidos (sem Stripe).`);
}
// 3) colunas ghost não podem reaparecer em query.
if (/plan_expires_at|payment_gateway|current_period_|payment_gateway_subscription_id/.test(code)) {
  failures.push(`${REL}: reapareceu referência a coluna de billing schema-ghost (plan_expires_at/payment_gateway*/current_period_*).`);
}
// 4) handlers de webhook ghost não podem voltar.
if (/handleInvoicePayment|handleSubscriptionDeleted|handleSubscriptionUpdated/.test(code)) {
  failures.push(`${REL}: reapareceram handlers de webhook que escreviam schema ghost.`);
}
// 5) webhook deve ser ACK no-op (200 contained), NÃO despachar nem retornar 400 (que dispara retry storm).
const whStart = code.search(/fastify\.post\(\s*['"]\/webhooks\/stripe['"]/);
if (whStart < 0) {
  failures.push(`${REL}: rota /webhooks/stripe desapareceu.`);
} else {
  const whEnd = code.indexOf('});', whStart);
  const wh = code.slice(whStart, whEnd > 0 ? whEnd + 3 : code.length);
  if (!/status\(\s*200\s*\)/.test(wh) || !/contained/.test(wh)) {
    failures.push(`${REL} /webhooks/stripe: deve ser no-op ACK 200 contained (evita retry storm da Stripe).`);
  }
  if (/await\s+handle|switch\s*\(\s*event/.test(wh)) {
    failures.push(`${REL} /webhooks/stripe: voltou a despachar handlers de billing.`);
  }
}
// 6) zero bank_* na frente.
if (/bank_ledger|bank_transactions|bank_splits/.test(code)) {
  failures.push(`${REL}: referencia bank_ledger/transactions/splits — fora de escopo (money path proibido).`);
}
// 7) event-settlement canônico intacto: a rota de organizers NÃO deve passar a fazer settlement.
if (/event_settlements|markAsSettled|settleEvent/.test(code)) {
  failures.push(`${REL}: passou a tocar event-settlement canônico — proibido (frente/decisão própria).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [organizer-billing-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [organizer-billing-ghost-containment] — subscription/billing/plan contidos (501 ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED) + webhook no-op ACK 200; zero organizerBillingService/stripeService/coluna-ghost/bank_*/event-settlement nas rotas. Billing schema-ghost blindado, decision-neutral.');
