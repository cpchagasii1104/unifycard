// src/core/availability/unified-availability.service.ts
// Service do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching
// 🔴 BLINDAGEM: Availability apenas expõe janelas disponíveis
// 🔴 BLINDAGEM: NÃO cria lógica decisória automática

import { createHash } from 'crypto';
import { getClientWithTenant, runQueryWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { unifiedAvailabilityRepository } from './unified-availability.repository';
import { detectAndEmitCrossMembershipSoftConflict } from './booking-soft-conflict';
import { resolveAvailabilityOwner, assertAvailabilityOwnerAuthorityActive } from './availability-owner-authority';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { authorizationService } from '@core/authorization/authorization.service';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '@core/errors';
import { getProtectedPurposeConceptIds } from './temporal-purpose';
import { ActorEffect } from '@core/social/ports';
import type {
  UnifiedAvailability,
  UnifiedBooking,
  CreateUnifiedAvailabilityInput,
  UpdateUnifiedAvailabilityInput,
  CreateUnifiedBookingInput,
  BookingSubject,
  UpdateUnifiedBookingInput,
  UnifiedAvailabilityFilters,
  UnifiedBookingFilters,
  CheckInInput,
  CheckOutInput,
  AvailabilityParticipant,
  CreateAvailabilityParticipantInput,
  UpdateAvailabilityParticipantInput,
  AvailabilityParticipantFilters,
  ConflictDetectionResult,
  AvailabilityConflict,
} from './unified-availability.types';
import { UnifiedBookingStatus, AvailabilityOwnerType } from './unified-availability.types';

/** `event_outbox.event_id` estável — seed `${eventType}:${tenantId}:${entityId}`; entityId = bookingId | participantId conforme o fluxo */
function deterministicAvailabilityEventId(
  tenantId: string,
  entityId: string,
  eventType: string
): string {
  const hash = createHash('sha256')
    .update(`${eventType}:${tenantId}:${entityId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

class UnifiedAvailabilityService {
  /**
   * Cria uma nova disponibilidade
   * 🔴 BLINDAGEM: ownerType e ownerId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Trigger previne sobreposição de horários por owner
   */
  async createAvailability(
    tenantId: string,
    userId: string,
    input: CreateUnifiedAvailabilityInput
  ): Promise<UnifiedAvailability> {
    // 🔴 BLINDAGEM: Validar que ownerType e ownerId foram fornecidos
    if (!input.ownerType) {
      throw new BadRequestError('ownerType é obrigatório para criar disponibilidade');
    }
    if (!input.ownerId) {
      throw new BadRequestError('ownerId é obrigatório para criar disponibilidade');
    }

    // 🔴 BLINDAGEM: Validar que startDatetime e endDatetime foram fornecidos
    if (!input.startDatetime || !input.endDatetime) {
      throw new BadRequestError('startDatetime e endDatetime são obrigatórios');
    }
    if (input.endDatetime <= input.startDatetime) {
      throw new BadRequestError('endDatetime deve ser posterior a startDatetime');
    }

    // 🔴 F-AVAILABILITY-WRITE-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA do owner ANTES da escrita. Chokepoint único
    // de WRITE (todo writer vivo passa por aqui). Resolve authorityActorId polimórfico (nunca ownerId cru) e recusa
    // se quarentenado. canRepresentActor (rota) prova representação; isto prova autoridade ATIVA. NÃO toca canRepresentActor.
    await assertAvailabilityOwnerAuthorityActive(tenantId, input.ownerType, input.ownerId);

    // 🔴 F-RENTAL-AVAILABILITY-OVERLAP (bug material 2026-07-08): NÃO existia trigger/constraint de
    // sobreposição (o comentário "trigger previne sobreposição" era falso). A verdade temporal é do
    // BANCO: rejeita janela ATIVA que sobreponha outra do mesmo recurso. 409 + a janela conflitante.
    const conflicts = await unifiedAvailabilityRepository.findOverlapping(
      tenantId, input.ownerType, input.ownerId, input.startDatetime!, input.endDatetime!);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      throw new ConflictError(
        `RENTAL_AVAILABILITY_OVERLAP: esta janela conflita com uma disponibilidade já cadastrada ` +
        `(${c.startDatetime.toISOString()} → ${c.endDatetime.toISOString()}).`);
    }

    // Cria disponibilidade. NÃO decide quem pode agendar, apenas expõe janelas.
    return await unifiedAvailabilityRepository.create(tenantId, input);
  }

  /**
   * Busca disponibilidade por ID
   */
  async getAvailability(tenantId: string, availabilityId: string): Promise<UnifiedAvailability> {
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, availabilityId);
    if (!availability) {
      throw new NotFoundError('Disponibilidade não encontrada');
    }
    return availability;
  }

  /**
   * Lista disponibilidades com filtros
   * 🔴 BLINDAGEM: Ordenação apenas por start_datetime ASC
   */
  async listAvailabilities(
    tenantId: string,
    filters: UnifiedAvailabilityFilters
  ): Promise<UnifiedAvailability[]> {
    return await unifiedAvailabilityRepository.findAvailabilities(tenantId, filters);
  }

  /**
   * Atualiza disponibilidade
   * 🔴 BLINDAGEM: Trigger previne sobreposição de horários por owner
   */
  async updateAvailability(
    tenantId: string,
    availabilityId: string,
    userId: string,
    input: UpdateUnifiedAvailabilityInput
  ): Promise<UnifiedAvailability> {
    // 🔴 BLINDAGEM: Validar que disponibilidade existe
    const existing = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, availabilityId);
    if (!existing) {
      throw new NotFoundError('Disponibilidade não encontrada');
    }

    // 🔴 F-AVAILABILITY-WRITE-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA do owner do recurso existente ANTES do UPDATE.
    await assertAvailabilityOwnerAuthorityActive(tenantId, existing.ownerType, existing.ownerId);

    // F-RENTAL-AVAILABILITY-OVERLAP: revalida sobreposição após a edição (excluindo a própria janela).
    const newStart = input.startDatetime ?? existing.startDatetime;
    const newEnd = input.endDatetime ?? existing.endDatetime;
    const conflicts = await unifiedAvailabilityRepository.findOverlapping(
      tenantId, existing.ownerType, existing.ownerId, newStart, newEnd, availabilityId);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      throw new ConflictError(
        `RENTAL_AVAILABILITY_OVERLAP: a janela editada conflita com outra já cadastrada ` +
        `(${c.startDatetime.toISOString()} → ${c.endDatetime.toISOString()}).`);
    }

    return await unifiedAvailabilityRepository.updateAvailability(tenantId, availabilityId, input);
  }

  /**
   * Remove uma janela de disponibilidade (o dono exclui a própria). Trava de autoridade-ativa do owner
   * + NÃO permite excluir se houver booking ativo (requested/confirmed/checked_in) — o tempo é SSOT.
   * availability não tem soft-delete → hard delete só quando seguro.
   */
  async deleteAvailability(tenantId: string, availabilityId: string, userId: string): Promise<void> {
    const existing = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, availabilityId);
    if (!existing) throw new NotFoundError('Disponibilidade não encontrada');
    await assertAvailabilityOwnerAuthorityActive(tenantId, existing.ownerType, existing.ownerId);
    const activeBookings = await unifiedAvailabilityRepository.countActiveBookings(tenantId, availabilityId);
    if (activeBookings > 0) {
      throw new ConflictError('AVAILABILITY_HAS_ACTIVE_BOOKING: esta janela tem reserva ativa e não pode ser excluída.');
    }
    await unifiedAvailabilityRepository.deleteAvailability(tenantId, availabilityId);
  }

  /**
   * Cria um novo booking
   * 🔴 BLINDAGEM: availabilityId e requesterActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: NÃO executa pagamento
   * 🔴 BLINDAGEM: Se booking envolver actor participante (ou owner_type user) e houver conflito, emite effect AVAILABILITY_CONFLICT_DETECTED
   */
  async createBooking(
    tenantId: string,
    subject: BookingSubject,
    input: CreateUnifiedBookingInput,
    trx?: { query: (q: { text: string; values?: any[] }) => Promise<any[]> }
  ): Promise<UnifiedBooking> {
    // 🔴 BLINDAGEM: Validar que availabilityId foi fornecido
    if (!input.availabilityId) {
      throw new BadRequestError('availabilityId é obrigatório para criar booking');
    }

    // 🔴 BLINDAGEM: Validar que availability existe
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, input.availabilityId);
    if (!availability) {
      throw new NotFoundError('Disponibilidade não encontrada');
    }

    // 🔴 DECISION-0151 FASE 2b — booking de RECURSO ALUGÁVEL HABILITADO (estado `requested`). A EXCLUSIVIDADE por
    // resource_id é aplicada no CONFIRM (confirmBookingWithResourceLock — ponto único, transacional, à prova de
    // corrida): dois `requested` podem coexistir, mas só UM confirma; o 2º sobreposto recebe 409
    // RENTAL_RESOURCE_TIME_CONFLICT. Create segue estado puro (sem dinheiro, sem reservar exclusividade ainda).

    // 🔴 P3 / DECISION-0147 (booking-gate): contratar SÓ oferta ACTIVE. Se a janela é de um service_offering,
    // o booking só é aceito se a oferta estiver `active` — draft/suspended NÃO são contratáveis (active =
    // autorização operacional de contratação, não status visual). Fail-closed.
    if (availability.ownerType === AvailabilityOwnerType.SERVICE_OFFERING) {
      const off = await runQueryWithTenant<{ status: string }>(
        tenantId,
        `SELECT status FROM service_offerings WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [availability.ownerId, tenantId]
      );
      if (!off || off.status !== 'active') {
        throw new BadRequestError(
          'OFFERING_NOT_ACTIVE: a oferta desta janela não está ativa/contratável (DECISION-0147); booking só em oferta active.'
        );
      }
    }

    // 🔴 DECISION-0132 §4 — GATE de finalidade: tempo pessoal PROTEGIDO (estudo/cuidados-pessoais/lazer)
    // NÃO é bookável por padrão. Bookability é regra DERIVADA da finalidade (não há coluna is_bookable).
    // `trabalho` e `NULL` (legado) seguem bookáveis. concept_ids protegidos resolvidos server-side por
    // (domain, slug) — nunca compara string crua da UI. (Aditivo; a blindagem de availability é preservada.)
    if (availability.purposeConceptId) {
      const protectedPurposeIds = await getProtectedPurposeConceptIds();
      if (protectedPurposeIds.has(availability.purposeConceptId)) {
        throw new BadRequestError(
          'AVAILABILITY_PERSONAL_PROTECTED: esta janela é tempo pessoal protegido (estudo/cuidados-pessoais/lazer) e não é bookável.'
        );
      }
    }

    // 🔴 DECISION-0148 — SUBJECT normalizado + AUTORIDADE revalidada NO CORE (não confia só no caller).
    // subjectUserId = principal humano (casa com actors.user_id); requesterActorId = actor acted-for.
    if (!subject?.subjectUserId || !subject?.requesterActorId) {
      throw new BadRequestError('BOOKING_SUBJECT_REQUIRED: subjectUserId e requesterActorId são obrigatórios (DECISION-0148).');
    }
    // Incremental: input.requesterActorId (se presente) DEVE casar com o subject — subject é a verdade.
    if (input.requesterActorId && input.requesterActorId !== subject.requesterActorId) {
      throw new BadRequestError('BOOKING_SUBJECT_REQUESTER_MISMATCH: input.requesterActorId diverge de subject.requesterActorId (DECISION-0148).');
    }
    const requesterActorId = subject.requesterActorId;

    // 🔴 BLINDAGEM (DECISION-0148): o subjectUserId precisa REPRESENTAR o requesterActorId — fail-closed.
    // O core NÃO depende mais do caller para provar autoridade (defesa-em-profundidade sobre DECISION-0113).
    const canRep = await authorizationService.canRepresentActor(tenantId, subject.subjectUserId, requesterActorId);
    if (!canRep) {
      throw new ForbiddenError('BOOKING_SUBJECT_NOT_AUTHORIZED: subjectUserId não pode representar requesterActorId (DECISION-0148; canRepresentActor fail-closed).');
    }

    // 🔴 BLINDAGEM: Validar que requester actor existe
    const actorRepository = socialPortsRegistry.getActorRepository();
    const requesterActor = await actorRepository.findById(tenantId, requesterActorId);
    if (!requesterActor) {
      throw new NotFoundError('Actor solicitante não encontrado');
    }

    // 🔴 BLINDAGEM: Criar booking (NÃO executa pagamento). requesterActorId canônico = do subject.
    const booking = await unifiedAvailabilityRepository.createBooking(tenantId, { ...input, requesterActorId }, trx);

    // 🔴 F-SERVICE-BOOKING-REQUESTED-EFFECT-EMISSION (DECISION-0156 D4, Slice C — SÓ depois de A+B,
    // agenda/discovery honestos, ambas fechadas): aviso honesto ao prestador de que um booking foi
    // solicitado. O effect já era definido/consumido pelo projetor de inbox, mas NUNCA era emitido —
    // o prestador só descobria por PULL manual (polling on-mount do hub). Alvo = resolveAvailabilityOwner
    // (para service_offering, provider_actor_id) — NUNCA payload.actorId cru nem o requester. Push =
    // "pull + aviso" (registra no inbox/feed via read-model projector), NÃO dispatch/auto-aceite — o
    // prestador ainda decide manualmente (aceitar/recusar continua em service-booking-decision.service.ts).
    // Não crítico: falha na emissão não desfaz o booking já criado (mesmo padrão de AVAILABILITY_CONFLICT_
    // DETECTED/SERVICE_BOOKING_CANCELLED abaixo). Money-free.
    try {
      const owner = await resolveAvailabilityOwner(tenantId, availability.ownerType, availability.ownerId);
      const outboxClient = await getClientWithTenant(tenantId);
      try {
        await outboxClient.query('BEGIN');
        await insertEventOutboxRow(outboxClient, {
          tenantId,
          eventId: deterministicAvailabilityEventId(
            tenantId,
            booking.bookingId,
            ActorEffect.SERVICE_BOOKING_REQUESTED
          ),
          eventType: ActorEffect.SERVICE_BOOKING_REQUESTED,
          eventVersion: 1,
          payload: {
            actorId: owner.authorityActorId, // Prestador a avisar — resolvido server-side, nunca do body/hint.
            actorType: 'user' as any, // Resolvido em Fase 7 se necessário (mesmo padrão de SERVICE_BOOKING_CANCELLED acima).
            intent: 'SERVICE_BOOKING_REQUESTED',
            sourceId: booking.bookingId,
            sourceType: 'unified_booking',
            metadata: {
              bookingId: booking.bookingId,
              availabilityId: input.availabilityId,
              requesterActorId,
              ownerType: availability.ownerType,
              ownerId: availability.ownerId,
              windowStart: availability.startDatetime.toISOString(),
              windowEnd: availability.endDatetime.toISOString(),
            },
          },
          metadata: {
            userId: subject.subjectUserId,
            bookingId: booking.bookingId,
            availabilityId: input.availabilityId,
          },
        });
        await outboxClient.query('COMMIT');
      } catch (outboxErr) {
        await outboxClient.query('ROLLBACK');
        throw outboxErr;
      } finally {
        outboxClient.release();
      }
    } catch (error) {
      // 🔴 BLINDAGEM: Não quebrar fluxo principal se enfileiramento falhar — booking já foi criado,
      // apenas o aviso ao prestador não foi emitido.
      console.error('[createBooking] Erro ao enfileirar effect SERVICE_BOOKING_REQUESTED (não crítico):', error);
    }

    // 🔴 BLINDAGEM: Detectar conflitos APÓS criar booking (não bloqueia)
    // Se booking envolver owner_type user e houver conflito, emitir effect AVAILABILITY_CONFLICT_DETECTED
    try {
      // Verificar se availability tem owner_type user (pessoa física)
      // Se sim, verificar se requester tem conflitos com suas próprias disponibilidades
      if (availability.ownerType === 'user') {
        const conflictResult = await this.detectConflicts(tenantId, input.availabilityId, input.requesterActorId);
        
        if (conflictResult.hasConflicts && conflictResult.conflicts.length > 0) {
          // 🔴 BLINDAGEM: Emitir effect de conflito detectado (alerta, não bloqueio)
          // O effect apenas registra o alerta, não bloqueia a criação do booking
          const conflictingAvailabilityIds = conflictResult.conflicts.map(c => c.conflictAvailabilityId);
          
          // 🔴 HARDENING: Log estruturado antes de emitir effect
          const { structuredLogger } = await import('@core/utils/structured-logger');
          structuredLogger.logEffectEmission('info', 'Emitindo effect AVAILABILITY_CONFLICT_DETECTED', {
            tenantId,
            actorId: input.requesterActorId,
            userId: subject.subjectUserId,
            effectType: 'AVAILABILITY_CONFLICT_DETECTED',
            availabilityId: input.availabilityId,
            bookingId: booking.bookingId,
            conflictCount: conflictResult.conflicts.length,
          });
          
          const outboxClient = await getClientWithTenant(tenantId);
          try {
            await outboxClient.query('BEGIN');
            await insertEventOutboxRow(outboxClient, {
              tenantId,
              eventId: deterministicAvailabilityEventId(
                tenantId,
                booking.bookingId,
                ActorEffect.AVAILABILITY_CONFLICT_DETECTED
              ),
              eventType: ActorEffect.AVAILABILITY_CONFLICT_DETECTED,
              eventVersion: 1,
              payload: {
                actorId: input.requesterActorId, // Actor que deve ser alertado (requester)
                actorType: requesterActor.actor_type,
                sourceId: input.availabilityId, // Availability principal
                sourceType: 'availability',
              },
              metadata: {
                availabilityId: input.availabilityId,
                bookingId: booking.bookingId,
                conflictingAvailabilityIds,
                windowStart: availability.startDatetime.toISOString(),
                windowEnd: availability.endDatetime.toISOString(),
                source: 'booking_created', // Fonte do conflito
                conflicts: conflictResult.conflicts.map(c => ({
                  conflictingAvailabilityId: c.conflictAvailabilityId,
                  conflictingOwnerType: c.conflictOwnerType,
                  conflictingOwnerId: c.conflictOwnerId,
                  conflictingStartDatetime: c.conflictStartDatetime.toISOString(),
                  conflictingEndDatetime: c.conflictEndDatetime.toISOString(),
                })),
              },
            });
            await outboxClient.query('COMMIT');
          } catch (err) {
            await outboxClient.query('ROLLBACK');
            throw err;
          } finally {
            outboxClient.release();
          }
        }
      }
    } catch (error) {
      // 🔴 BLINDAGEM: Não quebrar fluxo principal se emissão de effect falhar
      // O booking já foi criado, apenas o alerta não foi emitido
      // 🔴 HARDENING: Log estruturado para observabilidade
      const { structuredLogger } = await import('@core/utils/structured-logger');
      structuredLogger.logEffectEmission('error', 'Erro ao emitir effect AVAILABILITY_CONFLICT_DETECTED (não crítico)', {
        tenantId,
        actorId: availability.ownerId,
        userId: subject.subjectUserId,
        effectType: 'AVAILABILITY_CONFLICT_DETECTED',
        availabilityId: input.availabilityId,
        bookingId: booking.bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return booking;
  }

  /**
   * Busca booking por ID
   */
  async getBooking(tenantId: string, bookingId: string): Promise<UnifiedBooking> {
    const booking = await unifiedAvailabilityRepository.findBookingById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError('Booking não encontrado');
    }
    return booking;
  }

  /**
   * Lista bookings com filtros
   */
  async listBookings(
    tenantId: string,
    filters: UnifiedBookingFilters
  ): Promise<UnifiedBooking[]> {
    return await unifiedAvailabilityRepository.findBookings(tenantId, filters);
  }

  /**
   * Atualiza booking
   * 🔴 BLINDAGEM: NÃO executa pagamento
   */
  async updateBooking(
    tenantId: string,
    bookingId: string,
    userId: string,
    input: UpdateUnifiedBookingInput
  ): Promise<UnifiedBooking> {
    // 🔴 BLINDAGEM: Validar que booking existe
    const existing = await unifiedAvailabilityRepository.findBookingById(tenantId, bookingId);
    if (!existing) {
      throw new NotFoundError('Booking não encontrado');
    }

    // 🔴 F-OFFER-5/6 / DECISION-0146: a transição p/ COMPROMISSO (confirm) passa pelo GUARD de conflito por
    // provider, TRANSACIONAL e à prova de corrida. A entrada no conjunto bloqueante {confirmed,checked_in,
    // checked_out} ocorre SÓ via confirm (checkIn exige confirmed; checkOut exige checked_in — state-machine),
    // então confirm é o ponto ÚNICO. availability segue declarativa (não é tocada aqui).
    if (input.status === UnifiedBookingStatus.CONFIRMED) {
      const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, existing.availabilityId);
      if (!availability) {
        throw new NotFoundError('Disponibilidade do booking não encontrada');
      }
      // G10: owner_type ≠ service_offering → fora do guard cross-oferta (não adivinhar recurso); confirma normal.
      if (availability.ownerType === AvailabilityOwnerType.SERVICE_OFFERING) {
        // G9: provider DERIVADO server-side (availability(service_offering).owner_id → service_offerings.provider_actor_id);
        //     NUNCA do body. Intervalo vem da availability ligada ao booking, NUNCA do body.
        const owner = await resolveAvailabilityOwner(tenantId, AvailabilityOwnerType.SERVICE_OFFERING, availability.ownerId);
        const startIso = new Date(availability.startDatetime).toISOString();
        const endIso = new Date(availability.endDatetime).toISOString();
        const confirmedBooking = await unifiedAvailabilityRepository.confirmBookingWithProviderLock(
          tenantId,
          bookingId,
          owner.authorityActorId,
          startIso,
          endIso
        );
        // 🔴 F4 ARCO FUNDAÇÃO EVENTOS — AVISO SUAVE de conflito POR PESSOA (cross-membership).
        // DEPOIS do compromisso firmado (o 409 do hard-lock acima propaga ANTES de qualquer aviso):
        // detecta se alguma PESSOA da banda/ato recém-confirmado tem OUTRO compromisso confirmado
        // sobreposto (outras bandas via memberships ativas, ou solo) e emite o aviso no event_outbox
        // (sink OP-2 — ver booking-soft-conflict.ts). NUNCA bloqueia. NÃO-CRÍTICO: falha na detecção/
        // emissão jamais desfaz o confirm (mesmo padrão do SERVICE_BOOKING_REQUESTED no createBooking).
        // Este é o chokepoint ÚNICO de confirm (PATCH manual, C-POLICY auto-confirm e Surface-B
        // passam todos por aqui — §4.8), então o aviso cobre as 3 superfícies sem fork.
        try {
          await detectAndEmitCrossMembershipSoftConflict({
            tenantId,
            providerActorId: owner.authorityActorId,
            bookingId,
            availabilityId: existing.availabilityId,
            startIso,
            endIso,
          });
        } catch (softConflictErr) {
          console.error('[updateBooking] Erro no aviso suave de conflito cross-membership (não crítico):', softConflictErr);
        }
        return confirmedBooking;
      }
      // 🔴 DECISION-0151 FASE 2b: RECURSO ALUGÁVEL — exclusividade por RESOURCE (owner_id), NÃO provider.
      //    Confirm é o ponto ÚNICO; lock transacional por resource_id + conflito por owner_id em status
      //    bloqueante {confirmed,checked_in,checked_out}, self excluído, intervalo da availability (nunca do body).
      if (availability.ownerType === AvailabilityOwnerType.ACTOR_ASSET) {
        // SUBPERÍODO do booking quando houver (locação por período); senão a janela inteira (COALESCE).
        const startIso = new Date(existing.bookedStartDatetime ?? availability.startDatetime).toISOString();
        const endIso = new Date(existing.bookedEndDatetime ?? availability.endDatetime).toISOString();
        return await unifiedAvailabilityRepository.confirmBookingWithResourceLock(
          tenantId,
          bookingId,
          availability.ownerId, // = actor_assets.id (o item real — F-ASSET 2b-4)
          startIso,
          endIso
        );
      }
    }

    // 🔴 BLINDAGEM: Atualizar booking (NÃO executa pagamento)
    const updated = await unifiedAvailabilityRepository.updateBooking(tenantId, bookingId, input);

    // 🔴 B+A4 (Fase 2 plano v2.1 invariante 5): emissão de event SERVICE_BOOKING_CANCELLED
    // no outbox quando booking transita para 'cancelled'. Payload estruturado carrega
    // slot liberado + booking original + cancel_reason para recomposição futura (Fase 7)
    // sem migration de payload retroativa.
    // Effect é consequência sistêmica, NÃO decisão humana.
    if (input.status === UnifiedBookingStatus.CANCELLED && existing.status !== UnifiedBookingStatus.CANCELLED) {
      try {
        // Resolver availability associada para payload completo
        const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, updated.availabilityId);
        const cancelMetadata = (input.metadata ?? updated.metadata ?? {}) as Record<string, any>;

        const outboxClient = await getClientWithTenant(tenantId);
        try {
          await outboxClient.query('BEGIN');
          await insertEventOutboxRow(outboxClient, {
            tenantId,
            eventId: deterministicAvailabilityEventId(
              tenantId,
              bookingId,
              ActorEffect.SERVICE_BOOKING_CANCELLED
            ),
            eventType: ActorEffect.SERVICE_BOOKING_CANCELLED,
            eventVersion: 1,
            payload: {
              actorId: updated.requesterActorId, // Cliente afetado pelo cancelamento
              actorType: 'user' as any, // Resolvido em Fase 7 se necessário
              intent: 'CANCEL_BOOKING',
              sourceId: bookingId,
              sourceType: 'unified_booking',
              metadata: {
                // Slot liberado (v2.1 invariante 5 — para recomposição/JOIN com demand_attempts em Fase 7)
                slotStartDatetime: availability?.startDatetime ? new Date(availability.startDatetime).toISOString() : null,
                slotEndDatetime: availability?.endDatetime ? new Date(availability.endDatetime).toISOString() : null,
                slotOwnerType: availability?.ownerType ?? null,
                slotOwnerId: availability?.ownerId ?? null,
                // Booking original (cliente + preferências de recomposição se houver)
                bookingId,
                availabilityId: updated.availabilityId,
                requesterActorId: updated.requesterActorId,
                previousStatus: existing.status,
                // Razão do cancelamento (cancel_reason embedded por frontend em B+A3)
                cancelReason: cancelMetadata.cancel_reason ?? 'outro',
                cancelledVia: cancelMetadata.cancelled_via ?? 'unknown',
                // Metadata adicional preservada (service_type, urgency, acceptable_alternatives — se booking carregar)
                serviceType: cancelMetadata.service_type ?? existing.metadata?.service_type ?? null,
                urgency: cancelMetadata.urgency ?? existing.metadata?.urgency ?? null,
              },
            },
            metadata: {
              userId,
              bookingId,
              availabilityId: updated.availabilityId,
            },
          });
          await outboxClient.query('COMMIT');
        } catch (outboxErr) {
          await outboxClient.query('ROLLBACK');
          throw outboxErr;
        } finally {
          outboxClient.release();
        }
      } catch (error) {
        // 🔴 BLINDAGEM: Não quebrar fluxo principal se enfileiramento falhar
        // O booking já foi atualizado, apenas o alerta de recomposição não foi emitido
        console.error('[updateBooking] Erro ao enfileirar effect SERVICE_BOOKING_CANCELLED (não crítico):', error);
      }
    }

    return updated;
  }

  /**
   * Realiza check-in
   * 🔴 BLINDAGEM: Check-in é apenas registro, NÃO executa pagamento
   */
  async checkIn(
    tenantId: string,
    bookingId: string,
    userId: string,
    input: CheckInInput
  ): Promise<UnifiedBooking> {
    // 🔴 BLINDAGEM: Validar que booking existe
    const booking = await unifiedAvailabilityRepository.findBookingById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError('Booking não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que booking está confirmado antes de check-in
    if (booking.status !== UnifiedBookingStatus.CONFIRMED) {
      throw new BadRequestError('Apenas bookings confirmados podem fazer check-in');
    }

    // 🔴 BLINDAGEM: Realizar check-in (apenas registro, NÃO executa pagamento)
    return await unifiedAvailabilityRepository.checkIn(tenantId, bookingId, input.metadata);
  }

  /**
   * Realiza check-out
   * 🔴 BLINDAGEM: Check-out é apenas registro, NÃO executa pagamento
   */
  async checkOut(
    tenantId: string,
    bookingId: string,
    userId: string,
    input: CheckOutInput
  ): Promise<UnifiedBooking> {
    // 🔴 BLINDAGEM: Validar que booking existe
    const booking = await unifiedAvailabilityRepository.findBookingById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError('Booking não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que booking fez check-in antes de check-out
    if (!booking.checkedInAt) {
      throw new BadRequestError('Booking deve ter feito check-in antes de check-out');
    }

    // 🔴 BLINDAGEM: Realizar check-out (apenas registro, NÃO executa pagamento)
    return await unifiedAvailabilityRepository.checkOut(tenantId, bookingId, input.metadata);
  }

  /**
   * Cria um novo participante
   * 🔴 BLINDAGEM: availabilityId e actorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: NÃO bloqueia automaticamente conflitos
   * 🔴 BLINDAGEM: Se detectConflicts() retornar conflitos, emite effect AVAILABILITY_CONFLICT_DETECTED
   */
  async createParticipant(
    tenantId: string,
    userId: string,
    input: CreateAvailabilityParticipantInput
  ): Promise<AvailabilityParticipant> {
    // 🔴 BLINDAGEM: Validar que availabilityId foi fornecido
    if (!input.availabilityId) {
      throw new BadRequestError('availabilityId é obrigatório para criar participante');
    }

    // 🔴 BLINDAGEM: Validar que availability existe
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, input.availabilityId);
    if (!availability) {
      throw new NotFoundError('Disponibilidade não encontrada');
    }

    // 🔴 BLINDAGEM: Validar que actorId foi fornecido
    if (!input.actorId) {
      throw new BadRequestError('actorId é obrigatório para criar participante');
    }

    // 🔴 BLINDAGEM: Validar que actor existe
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, input.actorId);
    if (!actor) {
      throw new NotFoundError('Actor participante não encontrado');
    }

    // 🔴 BLINDAGEM: Criar participante (NÃO bloqueia conflitos)
    const participant = await unifiedAvailabilityRepository.createParticipant(tenantId, input);

    // 🔴 BLINDAGEM: Detectar conflitos APÓS criar participante (não bloqueia)
    // Se houver conflitos, emitir effect AVAILABILITY_CONFLICT_DETECTED
    try {
      const conflictResult = await this.detectConflicts(tenantId, input.availabilityId, input.actorId);
      
      if (conflictResult.hasConflicts && conflictResult.conflicts.length > 0) {
        // 🔴 BLINDAGEM: Emitir effect de conflito detectado (alerta, não bloqueio)
        // O effect apenas registra o alerta, não bloqueia a criação do participante
        const conflictingAvailabilityIds = conflictResult.conflicts.map(c => c.conflictAvailabilityId);
        
        // 🔴 HARDENING: Log estruturado antes de emitir effect
        const { structuredLogger } = await import('@core/utils/structured-logger');
        structuredLogger.logEffectEmission('info', 'Emitindo effect AVAILABILITY_CONFLICT_DETECTED', {
          tenantId,
          actorId: input.actorId,
          userId,
          effectType: 'AVAILABILITY_CONFLICT_DETECTED',
          availabilityId: input.availabilityId,
          conflictCount: conflictResult.conflicts.length,
        });
        
        const outboxClient = await getClientWithTenant(tenantId);
        try {
          await outboxClient.query('BEGIN');
          await insertEventOutboxRow(outboxClient, {
            tenantId,
            eventId: deterministicAvailabilityEventId(
              tenantId,
              participant.participantId,
              ActorEffect.AVAILABILITY_CONFLICT_DETECTED
            ),
            eventType: ActorEffect.AVAILABILITY_CONFLICT_DETECTED,
            eventVersion: 1,
            payload: {
              actorId: input.actorId, // Actor que deve ser alertado (participante)
              actorType: actor.actor_type,
              sourceId: input.availabilityId, // Availability principal
              sourceType: 'availability',
            },
            metadata: {
              availabilityId: input.availabilityId,
              conflictingAvailabilityIds,
              windowStart: availability.startDatetime.toISOString(),
              windowEnd: availability.endDatetime.toISOString(),
              source: 'participant_added', // Fonte do conflito
              conflicts: conflictResult.conflicts.map(c => ({
                conflictingAvailabilityId: c.conflictAvailabilityId,
                conflictingOwnerType: c.conflictOwnerType,
                conflictingOwnerId: c.conflictOwnerId,
                conflictingStartDatetime: c.conflictStartDatetime.toISOString(),
                conflictingEndDatetime: c.conflictEndDatetime.toISOString(),
              })),
            },
          });
          await outboxClient.query('COMMIT');
        } catch (err) {
          await outboxClient.query('ROLLBACK');
          throw err;
        } finally {
          outboxClient.release();
        }
      }
    } catch (error) {
      // 🔴 BLINDAGEM: Não quebrar fluxo principal se emissão de effect falhar
      // O participante já foi criado, apenas o alerta não foi emitido
      // 🔴 HARDENING: Log estruturado para observabilidade
      const { structuredLogger } = await import('@core/utils/structured-logger');
      structuredLogger.logEffectEmission('error', 'Erro ao emitir effect AVAILABILITY_CONFLICT_DETECTED (não crítico)', {
        tenantId,
        actorId: input.actorId,
        userId,
        effectType: 'AVAILABILITY_CONFLICT_DETECTED',
        availabilityId: input.availabilityId,
        participantId: participant.participantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return participant;
  }

  /**
   * Busca participante por ID
   */
  async getParticipant(tenantId: string, participantId: string): Promise<AvailabilityParticipant> {
    const participant = await unifiedAvailabilityRepository.findParticipantById(tenantId, participantId);
    if (!participant) {
      throw new NotFoundError('Participante não encontrado');
    }
    return participant;
  }

  /**
   * Lista participantes com filtros
   */
  async listParticipants(
    tenantId: string,
    filters: AvailabilityParticipantFilters
  ): Promise<AvailabilityParticipant[]> {
    return await unifiedAvailabilityRepository.findParticipants(tenantId, filters);
  }

  /**
   * Atualiza participante
   */
  async updateParticipant(
    tenantId: string,
    participantId: string,
    userId: string,
    input: UpdateAvailabilityParticipantInput
  ): Promise<AvailabilityParticipant> {
    // 🔴 BLINDAGEM: Validar que participante existe
    const existing = await unifiedAvailabilityRepository.findParticipantById(tenantId, participantId);
    if (!existing) {
      throw new NotFoundError('Participante não encontrado');
    }

    // 🔴 BLINDAGEM: Atualizar participante
    return await unifiedAvailabilityRepository.updateParticipant(tenantId, participantId, input);
  }

  /**
   * Remove participante
   */
  async deleteParticipant(
    tenantId: string,
    participantId: string,
    userId: string
  ): Promise<void> {
    // 🔴 BLINDAGEM: Validar que participante existe
    const existing = await unifiedAvailabilityRepository.findParticipantById(tenantId, participantId);
    if (!existing) {
      throw new NotFoundError('Participante não encontrado');
    }

    // 🔴 BLINDAGEM: Remover participante
    await unifiedAvailabilityRepository.deleteParticipant(tenantId, participantId);
  }

  /**
   * Detecta conflitos de horário para um participante
   * 🔴 BLINDAGEM: Esta função DETECTA conflitos, NÃO bloqueia
   * 🔴 BLINDAGEM: A confirmação cabe ao usuário
   * Retorna ALERTA, não bloqueio
   */
  async detectConflicts(
    tenantId: string,
    availabilityId: string,
    actorId: string
  ): Promise<ConflictDetectionResult> {
    // 🔴 BLINDAGEM: Validar que availability existe
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, availabilityId);
    if (!availability) {
      throw new NotFoundError('Disponibilidade não encontrada');
    }

    // 🔴 BLINDAGEM: Validar que actor existe
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      throw new NotFoundError('Actor não encontrado');
    }

    // 🔴 BLINDAGEM: Detectar conflitos (apenas informação, não decisão)
    // Retorna ALERTA, não bloqueio
    return await unifiedAvailabilityRepository.detectConflicts(tenantId, availabilityId, actorId);
  }
}

export const unifiedAvailabilityService = new UnifiedAvailabilityService();

