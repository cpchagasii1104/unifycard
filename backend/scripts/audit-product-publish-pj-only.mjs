#!/usr/bin/env node
// Guard estrutural — F-PRODUCT-PUBLISH-PF-BLOCK-SLICE-A
// (DT-PRODUCT-PUBLISH-NO-PF-PJ-ELIGIBILITY-GATE / DECISION-0155 — produto é PJ/CNPJ-only no MVP inicial).
//
// DECISION-0155 (W2 promulgada): no MVP inicial PRODUTO é exclusivo de PJ/empresa. Actor PF/user NÃO
// publica/oferta produto (segue prestando SERVIÇO, gates de serviço inalterados). Os DOIS caminhos vivos
// de publicação de produto devem FALHAR FECHADO quando o store actor representado é actor_type='user':
//   • caminho direto  productOfferingService.activateVariantAndCreateOffer  (product-offering.service.ts)
//   • caminho gêmeo   storeOnboardingService.createStoreOnboarding          (store-onboarding.service.ts)
// MORDE se: o bloqueio PF (actor_type === 'user' → 403 PRODUCT_PUBLISH_PJ_ONLY) sumir de qualquer um dos
// dois caminhos; ou o código fail-closed PRODUCT_PUBLISH_PJ_ONLY desaparecer. Não substitui o guard W1
// (audit-product-offer-actor-company-bind) — é complementar: W1 prova que o crachá é derivado do actor;
// este prova que PF nem chega a publicar. Estático (lê os dois services, comment-stripped). Em
// regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// ── caminho direto — product-offering.service.ts ──────────────────────────────────────
const FILE_A = 'src/modules/marketplace/product-offering.service.ts';
const pA = join(ROOT, FILE_A);
if (!existsSync(pA)) {
  failures.push(`arquivo ausente: ${FILE_A}`);
} else {
  const src = stripTs(readFileSync(pA, 'utf-8'));
  // PF (actor_type === 'user') deve falhar fechado ANTES de materializar/ofertar.
  if (!/sa\.actor_type\s*===\s*'user'/.test(src))
    failures.push('[direto] não bloqueia actor_type === \'user\' (PF) — DECISION-0155 exige PJ-only na publicação de produto.');
  if (!/PRODUCT_PUBLISH_PJ_ONLY/.test(src))
    failures.push('[direto] falta código fail-closed PRODUCT_PUBLISH_PJ_ONLY (bloqueio de produto PF no MVP).');
  // O bloqueio PF deve preceder o uso de derivedCompanyId (fail-closed antes da materialização).
  const idxPF = src.search(/sa\.actor_type\s*===\s*'user'/);
  const idxDerived = src.search(/const\s+derivedCompanyId\b/);
  if (idxPF >= 0 && idxDerived >= 0 && idxPF > idxDerived)
    failures.push('[direto] bloqueio PF aparece DEPOIS de derivedCompanyId — deve falhar fechado antes da materialização/oferta.');
}

// ── caminho gêmeo — store-onboarding.service.ts ───────────────────────────────────────
const FILE_B = 'src/modules/marketplace/store-onboarding.service.ts';
const pB = join(ROOT, FILE_B);
if (!existsSync(pB)) {
  failures.push(`arquivo ausente: ${FILE_B}`);
} else {
  const src = stripTs(readFileSync(pB, 'utf-8'));
  if (!/storeActorRow\.actor_type\s*===\s*'user'/.test(src))
    failures.push('[onboarding] não bloqueia actor_type === \'user\' (PF) — DECISION-0155 exige PJ-only na publicação de produto.');
  if (!/PRODUCT_PUBLISH_PJ_ONLY/.test(src))
    failures.push('[onboarding] falta código fail-closed PRODUCT_PUBLISH_PJ_ONLY (bloqueio de produto PF no MVP).');
  const idxPF = src.search(/storeActorRow\.actor_type\s*===\s*'user'/);
  const idxDerived = src.search(/const\s+derivedCompanyId\b/);
  if (idxPF >= 0 && idxDerived >= 0 && idxPF > idxDerived)
    failures.push('[onboarding] bloqueio PF aparece DEPOIS de derivedCompanyId — deve falhar fechado antes de derivar company/categorias/oferta.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [product-publish-pj-only]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [product-publish-pj-only] — DECISION-0155 blindada: nos DOIS caminhos de publicação de produto (oferta direta product-offering.service + store-onboarding/import em massa), actor_type='user' (PF) falha fechado com 403 PRODUCT_PUBLISH_PJ_ONLY antes de materializar/ofertar. Produto é PJ-only no MVP; serviço PF segue intocado. Complementar ao guard W1 (companyId derivado do actor).");
