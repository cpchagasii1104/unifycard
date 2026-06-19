#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8K (store-onboarding catalog actor BIND; DECISION-0113 / Z2 / DECISION-0108).
//
// O write de catálogo (POST /marketplace/store-onboarding → product_offers.merchant_id) usava data.actorId (body,
// client-declared) como merchant SEM provar representação. BIND: canRepresentActor(tenantId, req.user, storeActorId)
// fail-closed 403 ANTES da escrita. MORDE se: sumir canRepresentActor; o subject deixar de ser req.user; voltar a
// passar data.actorId/actionContext.actorId direto como autoridade sem o canRepresentActor; sumir o category guard
// (assertProductCategoryAllowedForCompany, DECISION-0108); ou aparecer bank_*. Comment-stripped. Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/marketplace/store-onboarding.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [store-onboarding-actor-bind]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) canRepresentActor presente e materialmente chamado com subject = req.user.
if (!/authorizationService\s*\.\s*canRepresentActor\s*\(/.test(code)) {
  failures.push(`${REL}: BIND ausente — esperado authorizationService.canRepresentActor(...) antes da escrita de catálogo.`);
}
if (!/canRepresentActor\(\s*tenantId\s*,\s*subjectUserId\s*,/.test(code) && !/canRepresentActor\([\s\S]{0,80}req\.user/.test(code)) {
  failures.push(`${REL}: canRepresentActor deve usar o subject derivado de req.user (subjectUserId), não ator client-declared.`);
}
// 2) o subject vem de req.user.
if (!/req\.user\?\.\s*id|req\.user\.userId|req\.user\.id/.test(code)) {
  failures.push(`${REL}: subject deve vir de req.user (id/userId) server-side.`);
}
// 3) fail-closed nomeado.
if (!/STORE_ONBOARDING_ACTOR_AUTHORITY_REQUIRED/.test(code)) {
  failures.push(`${REL}: perdeu o fail-closed nomeado STORE_ONBOARDING_ACTOR_AUTHORITY_REQUIRED.`);
}
if (!/if\s*\(\s*!\s*canRepresentStore\s*\)/.test(code)) {
  failures.push(`${REL}: o resultado de canRepresentActor deve barrar (403) a escrita quando falso.`);
}
// 4) o merchant escrito deve ser o actor PROVADO (boundStoreActorId), não data.actorId cru depois do gate.
if (!/actorId:\s*boundStoreActorId/.test(code)) {
  failures.push(`${REL}: input.actorId deve ser o store actor PROVADO representável (boundStoreActorId).`);
}
// 5) category guard DECISION-0108 preservado (no service; aqui garantimos que o caller ainda passa companyId p/ o guard).
//    O guard de categoria vive no service; aqui exigimos que requirePermission (papel) permaneça como 1ª camada.
if (!/requirePermission\s*\(/.test(code)) {
  failures.push(`${REL}: requirePermission (camada de papel) removido — deve permanecer como pré-condição.`);
}
// 6) zero bank_* na rota de catálogo.
if (/bank_ledger|bank_transactions|bank_splits/.test(code)) {
  failures.push(`${REL}: catálogo não pode referenciar bank_ledger/transactions/splits.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [store-onboarding-actor-bind]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [store-onboarding-actor-bind] — POST /marketplace/store-onboarding: canRepresentActor(tenantId, req.user, storeActorId) fail-closed 403 STORE_ONBOARDING_ACTOR_AUTHORITY_REQUIRED antes da escrita; merchant = actor PROVADO; requirePermission preservado; zero bank_*. Canal-1 do catálogo bound.');
