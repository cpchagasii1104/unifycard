#!/usr/bin/env node
// Guard estrutural — F-SERVICE-BOOKING-CONFIRM-CANONICAL-LOCK-SLICE-A1 (DECISION-0156 D7 /
// DT-SERVICE-BOOKING-CONFIRM-BYPASSES-LOCK).
//
// A Superfície B de confirmação (serviceOrderService.confirmBookingFromDecision → service_order) NÃO pode
// bypassar o lock/conflito canônico: a transição do booking aceito em COMPROMISSO deve DELEGAR ao mesmo caminho
// seguro da Superfície A (unifiedAvailabilityService.updateBooking(status=CONFIRMED) → confirmBookingWithProviderLock/
// ResourceLock) ANTES de criar a service_order. MORDE se: sumir a delegação a updateBooking(CONFIRMED) dentro do
// método; a delegação vier DEPOIS da criação da order (createOrder); ou o método voltar a usar a detecção
// não-bloqueante baseada no stub detect_availability_conflicts como "guard". Estático, comment-stripped. Em
// regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const SVC = 'src/modules/services/service-order.service.ts';
const svc = read(SVC);
if (svc === null) { failures.push(`arquivo ausente: ${SVC}`); }
else {
  const mStart = svc.indexOf('async confirmBookingFromDecision');
  if (mStart < 0) { failures.push(`${SVC}: método confirmBookingFromDecision ausente (Superfície B de confirm).`); }
  else {
    // fim do método = próximo "async " no mesmo nível (heurística estável para escopo)
    const mEnd = svc.indexOf('\n  async ', mStart + 10);
    const method = mEnd > mStart ? svc.slice(mStart, mEnd) : svc.slice(mStart);

    // 1) Delega ao caminho canônico de confirm (updateBooking com status CONFIRMED).
    const delegates = /unifiedAvailabilityService\.updateBooking\s*\(/.test(method)
      && /UnifiedBookingStatus\.CONFIRMED/.test(method);
    if (!delegates) failures.push(`${SVC}: confirmBookingFromDecision não delega ao lock canônico (unifiedAvailabilityService.updateBooking(status=CONFIRMED)) — bypass do lock.`);

    // 2) A delegação (lock) ocorre ANTES da criação da service_order (createOrder).
    const idxDelegate = method.search(/unifiedAvailabilityService\.updateBooking\s*\(/);
    const idxCreate = method.search(/serviceOrderRepository\.createOrder\s*\(/);
    if (idxCreate < 0) {
      failures.push(`${SVC}: não encontrei serviceOrderRepository.createOrder no método (escopo mudou — revisar guard).`);
    } else if (idxDelegate < 0 || idxDelegate > idxCreate) {
      failures.push(`${SVC}: o lock canônico deve rodar ANTES de criar a service_order (createOrder) — confirmar o slot depois da order permite double-booking.`);
    }

    // 3) O "guard" não pode ser a detecção não-bloqueante baseada no stub detect_availability_conflicts.
    if (/detectConflicts\s*\(/.test(method)) failures.push(`${SVC}: confirmBookingFromDecision não pode usar detectConflicts (não-bloqueante / stub detect_availability_conflicts) como guard de conflito.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-order-confirm-canonical-lock]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-order-confirm-canonical-lock] — Superfície B (confirmBookingFromDecision) delega ao lock/conflito canônico (updateBooking→confirmBookingWithProviderLock) ANTES de criar service_order; sem detecção não-bloqueante/stub. DECISION-0156 D7 / DT-SERVICE-BOOKING-CONFIRM-BYPASSES-LOCK blindada.');
