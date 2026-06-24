#!/usr/bin/env node
// Guard — F-RENTAL-RESOURCE-CORE FASE 2a (substrato; DECISION-0151).
//
// Locação = recurso bloqueado no tempo, reusando Unified Availability (sem agenda/booking/estoque/ledger paralelos).
// FASE 2a entrega SÓ o substrato; booking de rental é FAIL-CLOSED até a FASE 2b (exclusividade por resource_id).
// MORDE se: (1) enum⇆CHECK⇆policy não cobrirem rentable_resource em UNÍSSONO; (2) o booking de rental deixar de ser
// fail-closed (risco de duplo-aluguel sem conflito bloqueante); (3) rental tocar bank/order/checkout/payment;
// (4) rentable_resources ganhar coluna financeira; (5) surgir tabela paralela de agenda/booking de rental;
// (6) a migration de rental não referenciar DECISION-0151.

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };
const failures = [];

const TYPES = read('src/core/availability/unified-availability.types.ts') || '';
const AUTH = read('src/core/availability/availability-owner-authority.ts') || '';
const SVC = read('src/core/availability/unified-availability.service.ts') || '';
const REPO = read('src/core/availability/unified-availability.repository.ts') || '';

// 1) enum ⇆ CHECK ⇆ policy em uníssono p/ rentable_resource.
if (!/RENTABLE_RESOURCE\s*=\s*'rentable_resource'/.test(TYPES)) {
  failures.push("enum AvailabilityOwnerType sem RENTABLE_RESOURCE = 'rentable_resource'.");
}
if (!/\[AvailabilityOwnerType\.RENTABLE_RESOURCE\]/.test(AUTH) || !/rentable_resources/.test(AUTH)) {
  failures.push('OWNER_AUTHORITY_POLICIES sem branch RENTABLE_RESOURCE (resolve owner_actor_id de rentable_resources).');
}
const migs = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'));
const substrate = migs.find((f) => /rentable_resource/.test(f));
if (!substrate) {
  failures.push('migration de rentable_resource ausente.');
} else {
  const m = read(`migrations/${substrate}`) || '';
  if (!/owner_type IN \([^)]*'rentable_resource'/.test(m)) {
    failures.push(`${substrate}: CHECK de availability.owner_type não inclui 'rentable_resource'.`);
  }
  if (!/DECISION-0151/.test(m)) {
    failures.push(`${substrate}: DDL de rental sem referência à DECISION-0151.`);
  }
  // sem coluna financeira no registro do recurso — checar SÓ o DDL (comentários '--' removidos; eles listam o HOLD).
  const mNoComments = m.replace(/--[^\n]*/g, '');
  for (const bad of ['deposit', 'price_cents', 'amount_cents', 'late_fee', 'penalty', 'bank_ledger', 'bank_transactions', 'bank_splits']) {
    if (new RegExp(bad).test(mNoComments)) failures.push(`${substrate}: coluna/termo financeiro proibido no substrato de rental ('${bad}').`);
  }
}

// 2) FASE 2b: booking de rental HABILITADO, mas a EXCLUSIVIDADE por resource_id é BLOQUEANTE no confirm.
//    (a) confirm dispatcha RENTABLE_RESOURCE → confirmBookingWithResourceLock.
if (!/RENTABLE_RESOURCE[\s\S]{0,600}?confirmBookingWithResourceLock/.test(SVC)) {
  failures.push('confirm: owner_type rentable_resource NÃO usa confirmBookingWithResourceLock — booking de rental ficaria sem exclusividade bloqueante (risco de duplo-aluguel).');
}
//    (b) o lock existe no repo, é por RESOURCE (owner_id, NÃO provider) e lança RENTAL_RESOURCE_TIME_CONFLICT.
if (!/async confirmBookingWithResourceLock/.test(REPO)) {
  failures.push('repository sem confirmBookingWithResourceLock (lock de exclusividade por recurso).');
} else {
  const block = REPO.slice(REPO.indexOf('async confirmBookingWithResourceLock'), REPO.indexOf('async confirmBookingWithResourceLock') + 1400);
  if (!/owner_type\s*=\s*'rentable_resource'/.test(block) || !/a2\.owner_id\s*=\s*\$2/.test(block)) {
    failures.push('confirmBookingWithResourceLock: conflito NÃO é por owner_id/recurso (DECISION-0151: conflito por resource_id, não provider).');
  }
  if (/provider_actor_id/.test(block)) {
    failures.push('confirmBookingWithResourceLock: usa provider_actor_id — rental deve conflitar por RESOURCE, não provider.');
  }
  if (!/RENTAL_RESOURCE_TIME_CONFLICT/.test(block)) {
    failures.push('confirmBookingWithResourceLock: sem 409 RENTAL_RESOURCE_TIME_CONFLICT.');
  }
}
//    (c) P3 NÃO relaxado: provider-lock do service_offering preservado.
if (!/async confirmBookingWithProviderLock/.test(REPO) || !/SERVICE_OFFERING[\s\S]{0,600}?confirmBookingWithProviderLock/.test(SVC)) {
  failures.push('provider-lock do service_offering (P3) foi relaxado/removido — proibido (preservar DECISION-0146/0147).');
}

// 3) sem tabela/agenda/booking paralela de rental.
if (migs.some((f) => /rental_(availability|booking|schedule|reservation)/.test(f))) {
  failures.push('agenda/booking paralela de rental detectada — locação deve reusar Unified Availability (DECISION-0151).');
}

// 4) rental não toca dinheiro/order/checkout (no registro do recurso — futura readiness/route). Checa o substrato.
const RENTAL_FILES = ['src/core/availability/availability-owner-authority.ts'];
for (const rel of RENTAL_FILES) {
  const s = read(rel) || '';
  // só a parte do branch rental não pode importar bank/checkout/order — heurística: o arquivo todo não deve ganhar isso.
  if (/bank_ledger|bank_transactions|bank_splits|payment_intent|createCheckout|service_orders/.test(s)) {
    failures.push(`${rel}: resolver de availability tocou bank/order/checkout — proibido (DECISION-0151 HOLD).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [rental-resource-substrate]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [rental-resource-substrate] — rentable_resource em uníssono (enum⇆CHECK⇆policy); booking de rental confirma via confirmBookingWithResourceLock (exclusividade por resource_id, 409 RENTAL_RESOURCE_TIME_CONFLICT, não-provider); P3 provider-lock preservado; sem coluna financeira; sem agenda paralela; DDL cita DECISION-0151. FASE 2b.');
