#!/usr/bin/env node
// Guard estrutural — F-SERVICE-DISCOVERY-REQUEST-TRACK-RETIREMENT (DECISION-0156 D5+D6).
//
// SUPERSEDE F-AUTHORITY-Z2-R8P-SERVICES-DISCOVERY-NON-MONEY-AUTHORITY-BIND (DECISION-0113 / Z2):
// as 6 rotas actor-scoped que o bind R8P protegia (/offers, /request, /request/respond,
// /my-requests, /provider-requests, /request/:requestId) — MAIS /search e /metrics (D5, blob e
// métricas derivadas do trilho aposentado) — foram APOSENTADAS INCONDICIONALMENTE por
// DECISION-0156 D5 (services.metadata.availability = 2ª fonte de TEMPO) + D6
// (service_discovery_requests = 2ª fonte de ESTADO). Não há mais write/leitura actor-scoped
// alcançável — o bind de autoridade ficou sem alvo e foi removido junto com os handlers.
//
// MORDE:
//   (A) qualquer uma das 8 rotas voltar a ter lógica real (deixar de retornar
//       serviceDiscoveryTrackRetiredBody 403 incondicional);
//   (B) /search-by-term (a ÚNICA rota viva do módulo — não toca blob nem service_discovery_requests)
//       perder seu comportamento real ou ganhar o retirement por engano;
//   (C) /request/pay perder o retired R8J (SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110)
//       ou o firewall (isServiceFinancialRuntimeEnabled) como 1º gate — preservado desta fatia;
//   (D) reabertura do trilho money/sink (payAcceptedRequest/createSimpleTransaction/bank_*)
//       referenciado nas rotas.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

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

// (A) as 8 rotas retiradas devem chamar serviceDiscoveryTrackRetiredBody.
const retiredRouteBodies = [
  { name: "POST '/offers'", re: /fastify\.post\('\/offers'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('POST \/services\/offers'\)/ },
  { name: "GET '/metrics'", re: /fastify\.get\('\/metrics'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('GET \/services\/metrics'\)/ },
  { name: "GET '/search'", re: /fastify\.get\('\/search'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('GET \/services\/search'\)/ },
  { name: "GET '/my-requests'", re: /fastify\.get\('\/my-requests'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('GET \/services\/my-requests'\)/ },
  { name: "GET '/provider-requests'", re: /fastify\.get\('\/provider-requests'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('GET \/services\/provider-requests'\)/ },
  { name: "POST '/request/respond'", re: /fastify\.post\('\/request\/respond'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('POST \/services\/request\/respond'\)/ },
  { name: "GET '/request/:requestId'", re: /fastify\.get<[\s\S]{0,60}?>\('\/request\/:requestId'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('GET \/services\/request\/:requestId'\)/ },
  { name: "POST '/request'", re: /fastify\.post\('\/request'[\s\S]{0,300}?serviceDiscoveryTrackRetiredBody\('POST \/services\/request'\)/ },
];
for (const { name, re } of retiredRouteBodies) {
  if (!re.test(code)) {
    failures.push(`${REL}: rota ${name} não retorna serviceDiscoveryTrackRetiredBody 403 incondicional — aposentadoria D5/D6 regrediu.`);
  }
}

// (B) /search-by-term continua viva (não deve retornar o retirement).
const searchByTermIdx = code.indexOf(`fastify.get('/search-by-term'`);
const nextRouteIdx = code.indexOf(`fastify.get('/my-requests'`);
const searchByTermBody = searchByTermIdx >= 0 && nextRouteIdx > searchByTermIdx ? code.slice(searchByTermIdx, nextRouteIdx) : '';
if (!/servicesDiscoveryService\.searchByTerm/.test(searchByTermBody)) {
  failures.push(`${REL}: /search-by-term perdeu a chamada real a servicesDiscoveryService.searchByTerm — única rota viva do módulo.`);
}
if (/serviceDiscoveryTrackRetiredBody/.test(searchByTermBody)) {
  failures.push(`${REL}: /search-by-term ganhou o retirement por engano — essa rota é viva (usada pelo frontend), não deve ser aposentada.`);
}

// (C) /request/pay preserva retired R8J + firewall.
if (!/SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110/.test(code)) {
  failures.push(`${REL}: /request/pay perdeu o retired R8J (SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110).`);
}
if (!/isServiceFinancialRuntimeEnabled\(\)/.test(code)) {
  failures.push(`${REL}: /request/pay perdeu o firewall (isServiceFinancialRuntimeEnabled) como 1º gate.`);
}

// (D) PROIBIDO reabrir o trilho money/sink.
for (const re of [/payAcceptedRequest\s*\(/, /createSimpleTransaction/, /bank_ledger|bank_transactions|bank_splits/]) {
  if (re.test(code)) failures.push(`${REL}: voltou a referenciar trilho money/sink (${re}) — proibido (não reabrir direct-pay; zero bank_*).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [services-discovery-actor-bind]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [services-discovery-actor-bind] — 8 rotas do trilho paralelo (offers/metrics/search/request/respond/my-requests/provider-requests/request/:id) aposentadas incondicionalmente por DECISION-0156 D5+D6; /search-by-term (única viva) intacta; /request/pay retired (R8J) + firewall preservados; zero payAcceptedRequest/createSimpleTransaction/bank_*.');
