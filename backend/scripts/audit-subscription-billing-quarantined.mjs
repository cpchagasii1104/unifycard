#!/usr/bin/env node
// Guard — DECISION-0152 (F-SUBSCRIPTION-FRAGMENTS-QUARANTINE).
//
// Assinatura recorrente = cobrança recorrente = bank_ledger = MONEY → billing ADIADO p/ Camada 1 financeira
// (pós RLS-live/PORTA-1/payment-execution). Pré-money NÃO há billing novo; entitlement/membership = access_passes.
// Fragmentos mortos/stub NÃO podem acordar puxando dinheiro. Este guard MORDE se algum reviver:
//   (1) módulo Sprint87 (src/modules/subscriptions — DEAD, toca payment-execution/PaymentIntent) for registrado;
//   (2) o stub marketplace-subscriptions ganhar rota/billing real;
//   (3) o frontend reabilitar a rota <Route path="subscriptions"> (módulo fantasma).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const readRepo = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const readFront = (rel) => { const p = join(ROOT, '..', rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// RULE 1 — módulo Sprint87 (DEAD, money-touching) não pode ser registrado em runtime.
const builder = readRepo('src/app.builder.ts') || '';
const mktRoutes = readRepo('src/modules/marketplace/marketplace.routes.ts') || '';
const reg = strip(builder + '\n' + mktRoutes);
if (/['"][^'"]*subscriptions\/subscription\.(routes|service)['"]/.test(reg) ||
    /\bregisterSubscriptionRoutes\b|\bsubscriptionRoutes\b/.test(reg)) {
  failures.push('src/modules/subscriptions (Sprint87, DEAD + toca payment-execution/PaymentIntent) foi REGISTRADO em runtime. Quarentena DECISION-0152: billing recorrente é HOLD até Camada 1.');
}

// RULE 2 — stub marketplace-subscriptions deve permanecer stub (sem rota/billing real).
const mktSub = readRepo('src/modules/marketplace/routes/marketplace-subscriptions.routes.ts');
if (mktSub !== null) {
  const s = strip(mktSub);
  if (/createPaymentIntent|payment-execution|paymentExecution|\b(app|fastify)\.(post|put|patch)\s*\(/.test(s)) {
    failures.push('marketplace-subscriptions.routes deixou de ser STUB (ganhou rota/billing real). Billing recorrente é HOLD até Camada 1 (DECISION-0152).');
  }
}

// RULE 3 — frontend não pode reabilitar a rota subscriptions (módulo fantasma). Comentários JSX são removidos antes.
const app = readFront('frontend/src/App.tsx');
if (app !== null) {
  const noJsxComments = app.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  if (/<Route\s+path=["']subscriptions["']/.test(noJsxComments)) {
    failures.push('frontend/src/App.tsx reabilitou <Route path="subscriptions"> (módulo fantasma sem backend). Mantenha comentado até DECISION própria (0152).');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [subscription-billing-quarantined]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [subscription-billing-quarantined] — fragmentos de assinatura quarentenados (Sprint87 não registrado · marketplace-subscriptions stub · frontend route comentada). Billing recorrente = HOLD até Camada 1 financeira. Entitlement pré-money = access_passes. DECISION-0152.');
