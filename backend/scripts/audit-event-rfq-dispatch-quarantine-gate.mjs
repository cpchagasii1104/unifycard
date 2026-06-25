#!/usr/bin/env node
// Gate estrutural — F-EVENT-RFQ-DISPATCH-QUARANTINE-GATE (§4.8.4) — subfatia 3a de events/RFQ (só dispatch).
// Trava a cobertura de quarentena no único writer VIVO restante (dispatch é opportunity/notification, money-free):
//   - dispatchRFQToCompanies chama assertActorNotQuarantined(rfq.organizerActorId) ANTES do loop / createDispatch;
//   - o scope é o ORGANIZER (rfq.organizerActorId — actor já bound), NUNCA actionContext/userId cru;
//   - companyActorIds são TARGETS — NÃO são gateados como executores;
//   - acceptQuote segue CONTIDO (403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED) e NÃO foi alterado (freezer R7b);
//   - dispatch NÃO toca booking/payment_request/payment_intent/Bank;
//   - canRepresentActor NÃO recebeu quarentena (segue puro).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/events/event-rfq-opportunity.service.ts');
const ROUTES = join(process.cwd(), 'src/modules/events/event-rfq.routes.ts');
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

const raw = read(SVC);
if (!raw) {
  failures.push('EVENT_RFQ_DISPATCH_REGRESSION: event-rfq-opportunity.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('EVENT_RFQ_DISPATCH_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  }

  // dispatch: gate organizer ANTES do createDispatch
  checked++;
  {
    const body = sliceMethod(code, 'async dispatchRFQToCompanies(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*rfq\.organizerActorId\)/);
    const iWrite = body.search(/opportunityDispatchService\.createDispatch\s*\(/);
    if (iGate < 0) failures.push('EVENT_RFQ_DISPATCH_REGRESSION: dispatchRFQToCompanies NÃO gateia o organizer (rfq.organizerActorId).');
    else if (iWrite >= 0 && iGate > iWrite) failures.push('EVENT_RFQ_DISPATCH_REGRESSION: dispatch chama createDispatch ANTES do gate (tarde demais).');
    // companyActorId NÃO é gateado como executor
    if (/this\.assertActorNotQuarantined\(tenantId,\s*companyActorId\)/.test(body)) {
      failures.push('EVENT_RFQ_DISPATCH_REGRESSION: dispatch gateia companyActorId (target passivo) como executor — proibido.');
    }
    // gate não usa actionContext/userId cru
    if (/this\.assertActorNotQuarantined\(tenantId,\s*(actionContext|userId)\b/.test(body)) {
      failures.push('EVENT_RFQ_DISPATCH_REGRESSION: dispatch gateia actionContext/userId CRU (deve ser rfq.organizerActorId).');
    }
    // dispatch money-free
    if (/createBooking|payment_request|payment_intent|createPaymentRequest|bank_ledger|service_order/i.test(code)) {
      failures.push('EVENT_RFQ_DISPATCH_REGRESSION: event-rfq-opportunity passou a tocar booking/payment_request/payment_intent/bank — proibido (dispatch é opportunity).');
    }
  }
}

// acceptQuote segue contido (403) — freezer R7b intacto
{
  const routes = read(ROUTES);
  if (routes) {
    checked++;
    if (!/EVENT_RFQ_ACCEPT_QUOTE_CONTAINED/.test(routes) || !/CONTAINMENT_ACTIVE\s*=\s*true/.test(routes)) {
      failures.push('EVENT_RFQ_DISPATCH_REGRESSION: containment de acceptQuote (403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED / CONTAINMENT_ACTIVE=true) foi removido/alterado (freezer R7b).');
    }
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('EVENT_RFQ_DISPATCH_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[event-rfq-dispatch-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [event-rfq-dispatch-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [event-rfq-dispatch-quarantine-gate] — dispatch bloqueia o organizer quarentenado ANTES do createDispatch; companyActorIds são targets (não gateados); acceptQuote segue contido (R7b); money-free; canRepresentActor puro.');
