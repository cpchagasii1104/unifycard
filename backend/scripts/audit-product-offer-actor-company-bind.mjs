#!/usr/bin/env node
// Guard estrutural — F-PRODUCT-PUBLISH-COMPANY-BIND-SLICE-A
// (DT-PRODUCT-PUBLISH-COMPANYID-NOT-BOUND-TO-ACTOR / W1; DECISION-0108 input bound; DECISION-0113).
//
// O caminho direto de oferta de produto (productOfferingService.activateVariantAndCreateOffer)
// deve DERIVAR o "crachá de empresa" (companyId) que governa o guard de ramo a partir do ACTOR
// representado (server-side), nunca confiar no companyId do cliente como autoridade. MORDE se:
// a derivação por actors.company_id sumir; o createProduct ou o guard de ramo voltarem a usar
// input.companyId como fonte de verdade; o compat-check (companyId do body ≠ derivado → 403)
// sumir; os códigos fail-closed sumirem; ou o branch já-materializado voltar a guardear só quando
// o cliente envia companyId (bypass por omissão). Estático (lê product-offering.service.ts,
// comment-stripped). Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const FILE = 'src/modules/marketplace/product-offering.service.ts';
const p = join(ROOT, FILE);
const failures = [];

if (!existsSync(p)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(p, 'utf-8'));

  // 1) Derivação server-side: company_id vem de actors pelo storeActorId (scoped por tenant).
  if (!/company_id[\s\S]{0,40}FROM\s+actors\b/i.test(src))
    failures.push('não deriva company_id de actors (SELECT ... company_id ... FROM actors) — crachá não vem do actor.');
  if (!/storeActorId/.test(src))
    failures.push('derivação não usa input.storeActorId — actor representado deve ser a chave da derivação.');
  if (!/const\s+derivedCompanyId\b/.test(src))
    failures.push('derivedCompanyId ausente — companyId de autoridade precisa ser derivado server-side.');

  // 2) Autoridade usa o derivado, NÃO o body, no createProduct e no guard de ramo.
  if (!/companyId:\s*derivedCompanyId/.test(src))
    failures.push('createProduct não recebe companyId: derivedCompanyId — materialização usaria crachá do cliente.');
  if (!/assertProductCategoryAllowedForCompany\([^)]*derivedCompanyId\s*\)/.test(src))
    failures.push('guard de ramo (assertProductCategoryAllowedForCompany) não usa derivedCompanyId.');
  if (/assertProductCategoryAllowedForCompany\([^)]*input\.companyId\s*\)/.test(src))
    failures.push('guard de ramo ainda usa input.companyId como autoridade — PROIBIDO (W1).');
  if (/companyId:\s*input\.companyId/.test(src))
    failures.push('createProduct ainda usa input.companyId como autoridade — PROIBIDO (W1).');

  // 3) Branch já-materializado guardeia pelo DERIVADO (não por omissão do cliente = bypass).
  if (/else\s+if\s*\(\s*input\.companyId\s*\)/.test(src))
    failures.push('branch já-materializado guardeia por input.companyId (bypass por omissão) — deve ser derivedCompanyId.');

  // 4) Compat-check + fail-closed codes.
  if (!/input\.companyId\s*!=\s*null[\s\S]{0,80}!==\s*derivedCompanyId/.test(src))
    failures.push('compat-check ausente (input.companyId != null && input.companyId !== derivedCompanyId).');
  if (!/OFFER_COMPANY_MISMATCH/.test(src))
    failures.push('falta código 403 OFFER_COMPANY_MISMATCH (companyId do body ≠ derivado).');
  if (!/OFFER_ACTOR_TYPE_UNSUPPORTED/.test(src))
    failures.push('falta fail-closed OFFER_ACTOR_TYPE_UNSUPPORTED (group/unsupported).');
  if (!/canRepresentActor\s*\(/.test(src))
    failures.push('canRepresentActor ausente — representação (DECISION-0113) deve preceder a derivação.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [product-offer-actor-company-bind]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [product-offer-actor-company-bind] — oferta direta de produto deriva companyId do actor representado (actors.company_id via storeActorId), usa derivedCompanyId em createProduct e no guard de ramo (DECISION-0108), trata companyId do body só como compat-check (≠ derivado → 403 OFFER_COMPANY_MISMATCH), falha fechado em actor_type não suportado, e guardeia o branch já-materializado pelo derivado (sem bypass por omissão). W1/DT-PRODUCT-PUBLISH-COMPANYID-NOT-BOUND-TO-ACTOR blindada.");
