#!/usr/bin/env node
// Gate estrutural — F-SERVICE-BOOKING-DECISION-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena nas DUAS portas da decisão operacional de booking:
//   1) serviceBookingDecisionService.createDecision → assertAuthorityActorActive(owner.authorityActorId) ANTES do
//      insert em service_booking_decisions (repository.create);
//   2) serviceOrderService.confirmBookingFromDecision → assertAuthorityActorActive(owner.authorityActorId) ANTES da
//      criação da service_order (a "sala atrás da porta");
//   - o gate usa o authorityActorId RESOLVIDO via resolveAvailabilityOwner — NUNCA decidedByActorId/confirmedByActorId
//     cru nem booking.metadata.serviceId como autoridade;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - POST /service-orders direto continua contido (audit-service-order-write-authorship-binding cobre);
//   - schedules/schedule_slots sem writer vivo (audit-availability-quarantine-gate cobre).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DECISION = join(process.cwd(), 'src/modules/services/service-booking-decision.service.ts');
const ORDER = join(process.cwd(), 'src/modules/services/service-order.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n {2}(async|private|public|\w+\() /);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

// 1) createDecision: gate ANTES do insert; authorityActorId resolvido; não usa decidedByActorId cru no gate.
{
  const raw = read(DECISION);
  if (!raw) { failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: service-booking-decision.service.ts ausente.'); }
  else {
    checked++;
    const code = stripTs(raw);
    const body = sliceMethod(code, 'async createDecision(');
    if (!body) failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: createDecision não localizado.');
    else {
      const iGate = body.search(/assertAuthorityActorActive\s*\(\s*tenantId,\s*owner\.authorityActorId/);
      const iWrite = body.search(/serviceBookingDecisionRepository\.create\s*\(/);
      if (iGate < 0) failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: createDecision NÃO chama assertAuthorityActorActive(owner.authorityActorId) — decisão sem quarentena ou authority cru.');
      else if (iWrite >= 0 && iGate > iWrite) failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: createDecision grava decision ANTES do gate (tarde demais).');
      // gate não pode usar decidedByActorId cru
      if (/assertAuthorityActorActive\s*\(\s*tenantId,\s*input\.decidedByActorId/.test(body)) {
        failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: gate usa decidedByActorId CRU (deve ser owner.authorityActorId resolvido).');
      }
    }
  }
}

// 2) confirmBookingFromDecision: gate ANTES da criação da service_order; authorityActorId resolvido.
{
  const raw = read(ORDER);
  if (!raw) { failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: service-order.service.ts ausente.'); }
  else {
    checked++;
    const code = stripTs(raw);
    const body = sliceMethod(code, 'confirmBookingFromDecision(');
    if (!body) failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: confirmBookingFromDecision não localizado.');
    else {
      const iGate = body.search(/assertAuthorityActorActive\s*\(\s*tenantId,\s*owner\.authorityActorId/);
      const iWrite = body.search(/serviceOrderRepository\.create\s*\(|INSERT\s+INTO\s+service_orders/i);
      if (iGate < 0) failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: confirmBookingFromDecision NÃO chama assertAuthorityActorActive(owner.authorityActorId) — service_order sem quarentena (a sala atrás da porta).');
      else if (iWrite >= 0 && iGate > iWrite) failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: confirmBookingFromDecision cria service_order ANTES do gate (tarde demais).');
      if (/assertAuthorityActorActive\s*\(\s*tenantId,\s*confirmedByActorId/.test(body)) {
        failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: gate usa confirmedByActorId CRU (deve ser owner.authorityActorId resolvido).');
      }
    }
  }
}

// 3) canRepresentActor não recebeu quarentena
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) {
      failures.push('BOOKING_DECISION_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
    }
  }
}

console.log(`[service-booking-decision-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-booking-decision-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-booking-decision-quarantine-gate] — createDecision E confirmBookingFromDecision bloqueiam authority actor quarentenado (resolvido, nunca cru) ANTES da escrita; canRepresentActor puro.');
