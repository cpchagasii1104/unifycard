#!/usr/bin/env node
// Gate estrutural — F-EVENTS-LIFECYCLE-QUARANTINE-GATE (§4.8.4) — subfatia 1 de events/RFQ.
// Trava a cobertura de quarentena nos writers de lifecycle declarativo de EVENTO (a NASCENTE do event-feed):
//   - createEvent gateia scope (actorIdForEvent) E acting (createdByGlobalUserId) ANTES do INSERT INTO events;
//   - addSession/assignStaff/checkIn gateiam o humano acting (assertGlobalUserNotQuarantined) ANTES da escrita;
//   - o gate usa actorId RESOLVIDO / global_user_id do caller, NUNCA actionContext.actorId cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - event-feed handler NÃO foi tocado (gate é upstream); RFQ/acceptQuote/ticket/payment NÃO tocados nesta fatia;
//   - nenhum booking/payment_request/bank no caminho.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/events/events.service.ts');
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
function gateBeforeWrite(code, sig, writeRe, gateRe, label) {
  const body = sliceMethod(code, sig);
  if (!body) { failures.push(`EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: ${label} não localizado.`); return; }
  const iGate = body.search(gateRe);
  const iWrite = body.search(writeRe);
  if (iGate < 0) failures.push(`EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: ${label} NÃO chama o gate de quarentena — mutação sem quarentena.`);
  else if (iWrite >= 0 && iGate > iWrite) failures.push(`EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: ${label} escreve ANTES do gate (tarde demais).`);
}

const raw = read(SVC);
if (!raw) {
  failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: events.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helpers presentes
  checked++;
  const h1 = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!h1 || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(h1)) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  const h2 = sliceMethod(code, 'private async assertGlobalUserNotQuarantined(');
  if (!h2 || !/ensureUserActor\s*\(/.test(h2) || !/this\.assertActorNotQuarantined\(/.test(h2)) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: helper assertGlobalUserNotQuarantined ausente/não resolve actor+gate.');

  // createEvent: gate scope (actorIdForEvent) + acting (createdByGlobalUserId) ANTES do INSERT INTO events
  checked++;
  {
    const body = sliceMethod(code, 'async createEvent(');
    const iScope = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorIdForEvent\)/);
    const iActing = body.search(/this\.assertGlobalUserNotQuarantined\(tenantId,\s*createdByGlobalUserId\)/);
    const iInsert = body.search(/INSERT\s+INTO\s+events\b/i);
    if (iScope < 0) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: createEvent NÃO gateia o scope (actorIdForEvent).');
    else if (iInsert >= 0 && iScope > iInsert) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: createEvent INSERT antes do gate de scope.');
    if (iActing < 0) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: createEvent NÃO gateia o acting (createdByGlobalUserId).');
    else if (iInsert >= 0 && iActing > iInsert) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: createEvent INSERT antes do gate de acting.');
  }

  // addSession / assignStaff / checkIn: gate acting ANTES da escrita
  checked++;
  gateBeforeWrite(code, 'async addSession(', /INSERT\s+INTO\s+event_sessions\b/i, /this\.assertGlobalUserNotQuarantined\(tenantId,\s*actingGlobalUserId\)/, 'addSession');
  gateBeforeWrite(code, 'async assignStaff(', /INSERT\s+INTO\s+event_staff\b/i, /this\.assertGlobalUserNotQuarantined\(tenantId,\s*assignedByGlobalUserId\)/, 'assignStaff');
  gateBeforeWrite(code, 'async checkIn(', /INSERT\s+INTO\s+event_attendees\b/i, /this\.assertGlobalUserNotQuarantined\(tenantId,\s*globalUserId\)/, 'checkIn');

  // gate não usa actionContext cru
  checked++;
  if (/assert(Actor|GlobalUser)NotQuarantined\(tenantId,\s*actionContext/.test(code)) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: gate usa actionContext.actorId CRU.');

  // money/RFQ/acceptQuote NÃO entram em events.service nesta fatia
  checked++;
  if (/acceptQuote|createRFQ|dispatchRFQToCompanies|payment_request|payment_intents|createBooking|service_order|bank_ledger/i.test(code)) {
    failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: events.service passou a referenciar RFQ/acceptQuote/booking/payment_request/bank — fora do escopo desta subfatia.');
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('EVENTS_LIFECYCLE_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[events-lifecycle-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [events-lifecycle-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [events-lifecycle-quarantine-gate] — createEvent (scope+acting) e addSession/assignStaff/checkIn (acting) bloqueiam quarentenado ANTES da escrita; gate upstream da nascente; sem RFQ/acceptQuote/booking/payment; canRepresentActor puro.');
