#!/usr/bin/env node
// Gate estrutural — F-EVENT-RFQ-DECLARATIVE-QUARANTINE-GATE (§4.8.4) — subfatia 2 de events/RFQ.
// Trava a cobertura de quarentena nos writers RFQ DECLARATIVOS (procurement/metadata; money-free):
//   - createRFQ gateia organizer (scope) ANTES do UPDATE events SET metadata;
//   - closeRFQ gateia closedByActor (scope) ANTES do UPDATE events SET metadata;
//   - createQuote gateia provider (scope) ANTES do UPDATE events SET metadata (quote = PROPOSTA);
//   - o gate usa o actorId RESOLVIDO (organizerActorId/closedByActorId/providerActorId), NUNCA actionContext/userId cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - acceptQuote / dispatchRFQToCompanies / booking / payment_request / availability NÃO entram nesta fatia
//     (acceptQuote materializador money-adjacent = subfatia 3).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/events/event-rfq.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}
function gateBeforeWrite(code, sig, scopeExpr, label) {
  const body = sliceMethod(code, sig);
  if (!body) { failures.push(`EVENT_RFQ_DECLARATIVE_REGRESSION: ${label} não localizado.`); return; }
  const gateRe = new RegExp(`this\\.assertActorNotQuarantined\\(tenantId,\\s*${scopeExpr}\\)`);
  const iGate = body.search(gateRe);
  const iWrite = body.search(/UPDATE\s+events\s*\n?\s*SET\s+metadata/i);
  if (iGate < 0) failures.push(`EVENT_RFQ_DECLARATIVE_REGRESSION: ${label} NÃO gateia o scope (${scopeExpr}) — mutação sem quarentena.`);
  else if (iWrite >= 0 && iGate > iWrite) failures.push(`EVENT_RFQ_DECLARATIVE_REGRESSION: ${label} escreve metadata ANTES do gate (tarde demais).`);
}

const raw = read(SVC);
if (!raw) {
  failures.push('EVENT_RFQ_DECLARATIVE_REGRESSION: event-rfq.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('EVENT_RFQ_DECLARATIVE_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  }

  // 3 writers declarativos: gate antes do UPDATE metadata
  checked++;
  gateBeforeWrite(code, 'async createRFQ(', 'organizerActorId', 'createRFQ');
  gateBeforeWrite(code, 'async closeRFQ(', 'closedByActorId', 'closeRFQ');
  gateBeforeWrite(code, 'async createQuote(', 'providerActorId', 'createQuote');

  // gate não usa actionContext/userId cru
  checked++;
  if (/assertActorNotQuarantined\(tenantId,\s*(actionContext|userId)\b/.test(code)) {
    failures.push('EVENT_RFQ_DECLARATIVE_REGRESSION: gate usa actionContext.actorId/userId CRU (deve ser actorId resolvido).');
  }

  // acceptQuote / dispatch / booking / payment_request NÃO ganham gate de quarentena nesta fatia (ficam p/ subfatia 3)
  checked++;
  const accept = sliceMethod(code, 'async acceptQuote(');
  if (accept && /this\.assertActorNotQuarantined\(/.test(accept)) {
    failures.push('EVENT_RFQ_DECLARATIVE_REGRESSION: acceptQuote ganhou gate nesta fatia — é money-adjacent (booking+payment_request), pertence à subfatia 3.');
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('EVENT_RFQ_DECLARATIVE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[event-rfq-declarative-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [event-rfq-declarative-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [event-rfq-declarative-quarantine-gate] — createRFQ/closeRFQ/createQuote bloqueiam o scope quarentenado ANTES do UPDATE metadata; acceptQuote/dispatch intocados (subfatia 3); actorId resolvido; canRepresentActor puro.');
