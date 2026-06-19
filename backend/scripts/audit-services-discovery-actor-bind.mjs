#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8P-SERVICES-DISCOVERY-NON-MONEY-AUTHORITY-BIND (DECISION-0113 / Z2).
//
// As 6 rotas actor-scoped não-money (/offers, /request, /request/respond, /my-requests, /provider-requests,
// /request/:requestId) usavam actionContext.actorId (client-declared) como actor operacional/filtro — spoofável.
// BIND: helper assertActorRepresentable → canRepresentActor(req.tenant.id, req.user.id, actionContext.actorId)
// fail-closed (401/403 SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED) ANTES de qualquer write/leitura. MORDE se: o
// helper sumir/deixar de usar canRepresentActor; o nº de call-sites do bind cair abaixo de 6 (alguma rota
// regrediu); /request/pay deixar de estar retired (R8J) ou perder o firewall; a rota voltar a chamar
// payAcceptedRequest/createSimpleTransaction; ou aparecer bank_*. Comment-stripped. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/services/services-discovery.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [services-discovery-actor-bind]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) helper de bind presente: canRepresentActor(req.tenant.id, req.user.id, actionContext.actorId) + fail-closed nomeado.
if (!/const\s+assertActorRepresentable\s*=/.test(code)) {
  failures.push(`${REL}: helper assertActorRepresentable removido.`);
}
if (!/canRepresentActor\(\s*req\.tenant\.id\s*,\s*req\.user\.id\s*,\s*req\.actionContext\.actorId\s*\)/.test(code)) {
  failures.push(`${REL}: o bind deve ser canRepresentActor(req.tenant.id, req.user.id, req.actionContext.actorId).`);
}
if (!/SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED/.test(code)) {
  failures.push(`${REL}: perdeu o fail-closed nomeado SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED.`);
}
// 2) as 6 rotas actor-scoped DEVEM chamar o helper (1 def + 6 call-sites = 7 ocorrências).
const occurrences = (code.match(/assertActorRepresentable/g) || []).length;
if (occurrences < 7) {
  failures.push(`${REL}: esperado >= 7 ocorrências de assertActorRepresentable (1 def + 6 rotas actor-scoped), achadas ${occurrences} — alguma rota regrediu o bind.`);
}
const callSites = (code.match(/if\s*\(\s*!\s*\(\s*await\s+assertActorRepresentable\(\s*req\s*,\s*reply\s*\)\s*\)\s*\)\s*return\s+reply\s*;/g) || []).length;
if (callSites < 6) {
  failures.push(`${REL}: esperado >= 6 call-sites do bind fail-closed (await assertActorRepresentable), achados ${callSites}.`);
}
// 3) /request/pay PRESERVA retired (R8J) + firewall como 1º gate.
if (!/SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110/.test(code)) {
  failures.push(`${REL}: /request/pay perdeu o retired R8J (SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110).`);
}
if (!/isServiceFinancialRuntimeEnabled\(\)/.test(code)) {
  failures.push(`${REL}: /request/pay perdeu o firewall (isServiceFinancialRuntimeEnabled) como 1º gate.`);
}
// 4) PROIBIDO reabrir o trilho money/sink.
for (const re of [/payAcceptedRequest\s*\(/, /createSimpleTransaction/, /bank_ledger|bank_transactions|bank_splits/]) {
  if (re.test(code)) failures.push(`${REL}: voltou a referenciar trilho money/sink (${re}) — proibido (não reabrir direct-pay; zero bank_*).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [services-discovery-actor-bind]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [services-discovery-actor-bind] — 6 rotas actor-scoped (offers/request/respond/my-requests/provider-requests/request/:id) bound por assertActorRepresentable → canRepresentActor(req.tenant.id, req.user.id, actionContext.actorId) fail-closed; /request/pay retired (R8J) + firewall preservados; zero payAcceptedRequest/createSimpleTransaction/bank_*. Non-money authority bound.');
