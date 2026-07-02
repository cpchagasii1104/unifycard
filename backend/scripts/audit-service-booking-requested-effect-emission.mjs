#!/usr/bin/env node
// Guard estrutural — F-SERVICE-BOOKING-REQUESTED-EFFECT-EMISSION (DT-SERVICE-BOOKING-REQUESTED-
// EFFECT-NOT-EMITTED, DECISION-0156 D4, Slice C).
//
// SERVICE_BOOKING_REQUESTED era definido/consumido pelo projetor de inbox, mas NUNCA emitido — o
// prestador só descobria reservas por PULL manual. Corrigido: emitido no create booking canônico
// (unifiedAvailabilityService.createBooking), alvo = resolveAvailabilityOwner (NUNCA payload.actorId
// cru nem o requester), não-crítico (falha na emissão não desfaz o booking já criado), money-free.
//
// MORDE:
//   (A) a emissão sumir de createBooking;
//   (B) o alvo (payload.actorId) deixar de vir de resolveAvailabilityOwner (voltar a usar
//       requesterActorId/input.actorId cru — mentiria sobre quem precisa ser avisado);
//   (C) a emissão passar a bloquear o fluxo principal (sair do try/catch não-crítico) — booking já
//       criado nunca deve desfazer por falha de notificação;
//   (D) qualquer referência a bank_*/dinheiro na emissão (deve ser puramente notification/event).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/core/availability/unified-availability.service.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [service-booking-requested-effect-emission]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const rawCode = readFileSync(p, 'utf-8');
const code = stripTs(rawCode);

// (A) emissão presente dentro de createBooking, ANTES do bloco de conflito (mesma ordem: create →
// aviso → conflito), ligada a ActorEffect.SERVICE_BOOKING_REQUESTED.
const createIdx = code.indexOf('async createBooking(');
const conflictIdx = code.indexOf('const conflictResult = await this.detectConflicts', createIdx);
const createBody = createIdx >= 0 && conflictIdx > createIdx ? code.slice(createIdx, conflictIdx) : '';
if (!/insertEventOutboxRow/.test(createBody) || !/ActorEffect\.SERVICE_BOOKING_REQUESTED/.test(createBody)) {
  failures.push(`${REL}: createBooking não emite mais ActorEffect.SERVICE_BOOKING_REQUESTED via insertEventOutboxRow.`);
}

// (B) alvo vem de resolveAvailabilityOwner (não de requesterActorId/input.actorId cru).
if (!/resolveAvailabilityOwner\(tenantId, availability\.ownerType, availability\.ownerId\)/.test(createBody)) {
  failures.push(`${REL}: alvo do aviso não deriva de resolveAvailabilityOwner(tenantId, availability.ownerType, availability.ownerId).`);
}
if (!/actorId:\s*owner\.authorityActorId/.test(createBody)) {
  failures.push(`${REL}: payload.actorId da emissão SERVICE_BOOKING_REQUESTED não é owner.authorityActorId — pode ter voltado a usar requester/hint cru.`);
}

// (C) emissão fica em try/catch não-crítico (não propaga erro que desfaria o booking). Checa no
// RAW (com comentários — o marcador de intenção é textual) + estrutural (catch não re-lança).
const rawCreateIdx = rawCode.indexOf('async createBooking(');
const rawConflictIdx = rawCode.indexOf('const conflictResult = await this.detectConflicts', rawCreateIdx);
const rawCreateBody = rawCreateIdx >= 0 && rawConflictIdx > rawCreateIdx ? rawCode.slice(rawCreateIdx, rawConflictIdx) : '';
if (!/não crítico/.test(rawCreateBody) && !/BLINDAGEM: Não quebrar fluxo principal/.test(rawCreateBody)) {
  failures.push(`${REL}: emissão de SERVICE_BOOKING_REQUESTED sem marcação clara de não-crítico (try/catch que não propaga).`);
}
const emissionCatchIdx = createBody.indexOf('} catch (error) {', createBody.indexOf('SERVICE_BOOKING_REQUESTED'));
const emissionCatchBlock = emissionCatchIdx >= 0 ? createBody.slice(emissionCatchIdx, emissionCatchIdx + 300) : '';
if (/throw /.test(emissionCatchBlock)) {
  failures.push(`${REL}: catch da emissão SERVICE_BOOKING_REQUESTED re-lança o erro — propagaria falha de notificação como falha do booking.`);
}

// (D) zero referência a bank_*/dinheiro na emissão.
if (/bank_ledger|bank_transactions|bank_splits|createSimpleTransaction/.test(createBody)) {
  failures.push(`${REL}: emissão de SERVICE_BOOKING_REQUESTED referencia trilho money — deve ser puramente notification/event.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-booking-requested-effect-emission]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-booking-requested-effect-emission] — SERVICE_BOOKING_REQUESTED emitido no create booking canônico, alvo = resolveAvailabilityOwner (provider real, nunca hint/requester cru), não-crítico, money-free. DT-SERVICE-BOOKING-REQUESTED-EFFECT-NOT-EMITTED blindada.');
