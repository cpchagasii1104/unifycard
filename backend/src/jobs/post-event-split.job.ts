// src/jobs/post-event-split.job.ts
// Job de Split Pós-Evento (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Split só ocorre após evento, baseado em check-ins

import { escrowService } from '@core/economy/escrow.service';
import { penaltyService } from '@core/reputation/penalty.service';
import { splitEngineService } from '@core/economy/split.service';
import { accountService } from '@core/economy/accounts/account.service';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestError } from '@core/errors';

interface EventParticipant {
  id: string;
  actor_id: string;
  actor_type: string;
  role: string;
  responsibility_level: number;
  agreed_amount_cents: number;
  expected_headcount: number;
  checked_in_count: number;
  attendance_status: 'PRESENT' | 'LEFT_EARLY' | 'NO_SHOW' | null;
  account_id: string | null;
}

interface EventRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  event_type: string;
  ticket_price_cents: number | null;
  datetime_start: Date;
  datetime_end: Date | null;
  status: string;
}

class PostEventSplitJob {
  /**
   * Executa split pós-evento
   * Chamado pelo scheduler após evento terminar
   * CONTRATO v1.3: Split baseado em check-ins
   */
  async execute(tenantId: string, eventId: string): Promise<void> {
    console.log(`[PostEventSplit] Iniciando para evento ${eventId}`);

    // 1. Verificar se evento já foi processado
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      console.log(`[PostEventSplit] Evento não encontrado`);
      return;
    }

    // Verificar se já foi processado (campo split_processed)
    const processed = await runQueryWithTenant<{ split_processed: boolean }>(
      tenantId,
      `SELECT split_processed FROM events WHERE id = $1`,
      [eventId]
    );

    if (processed?.split_processed) {
      console.log(`[PostEventSplit] Evento já processado`);
      return;
    }

    // 2. Verificar que evento está COMPLETED (HARD LOCK)
    if (event.status !== 'completed' || !event.datetime_end || new Date(event.datetime_end) > new Date()) {
      console.log(`[PostEventSplit] Evento não está COMPLETED, aguardando...`);
      return;
    }

    // 3. Iniciar liberação do escrow (HARD LOCK: só libera se COMPLETED)
    await escrowService.startRelease(tenantId, eventId);

    // 4. Buscar participantes com attendance_status
    const participants = await this.getParticipantsWithCheckIn(tenantId, eventId);

    // 5. Processar pagamento de cada participante (baseado em attendance_status)
    // CONTRATO v1.4: PRESENT → 100%, LEFT_EARLY → 50%, NO_SHOW → 0%
    const LEFT_EARLY_PAYMENT_RATE = 0.5; // Configurável, default 50%

    for (const participant of participants) {
      if (!participant.account_id) {
        console.warn(`[PostEventSplit] Participante ${participant.id} sem conta, pulando`);
        continue;
      }

      // Calcular pagamento baseado em attendance_status
      let paymentRate = 0;
      const status = participant.attendance_status || 'NO_SHOW';

      if (status === 'PRESENT') {
        paymentRate = 1.0; // 100%
      } else if (status === 'LEFT_EARLY') {
        paymentRate = LEFT_EARLY_PAYMENT_RATE; // 50% (configurável)
      } else {
        // NO_SHOW ou null
        paymentRate = 0; // 0%
      }

      const adjustedAmount = Math.floor(participant.agreed_amount_cents * paymentRate);

      if (adjustedAmount > 0) {
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId: participant.account_id,
          amountCents: adjustedAmount,
          participantId: participant.id,
          reason: `PARTICIPANT_PAYMENT_${participant.role}_${status}`,
          idempotencyKey: `split-${eventId}-${participant.id}-${uuidv4()}`,
        });
      }

      // CONTRATO v1.4: Atualizar score baseado em attendance_status
      await penaltyService.updateScoreFromAttendance(
        tenantId,
        participant.actor_id,
        participant.actor_type as 'user' | 'page',
        status as 'PRESENT' | 'LEFT_EARLY' | 'NO_SHOW',
        eventId
      );

      // Aplicar penalidades adicionais baseado em status
      if (status === 'NO_SHOW') {
        if (participant.responsibility_level === 1) {
          // Atração principal: penalidade severa
          await penaltyService.processMainAttractionNoShow(
            tenantId,
            eventId,
            participant.actor_id,
            participant.actor_type as 'user' | 'page'
          );
        } else {
          // Colaborador: penalidade padrão
          await penaltyService.processCollaboratorNoShow(
            tenantId,
            eventId,
            participant.actor_id,
            participant.actor_type as 'user' | 'page'
          );
        }
      } else if (status === 'LEFT_EARLY') {
        // Saída antecipada: penalidade leve
        await penaltyService.applyPenalty(
          tenantId,
          participant.actor_id,
          participant.actor_type as 'user' | 'page',
          'PARTIAL_DELIVERY',
          eventId
        );
      }
    }

    // 6. Calcular e distribuir restante (organizador + splits fixos)
    await this.distributeRemainder(tenantId, eventId, event);

    // 7. Processar avaliações automáticas (compradores que não foram)
    await this.processBuyerNoShows(tenantId, eventId);

    // 8. Finalizar escrow
    await escrowService.complete(tenantId, eventId);

    // 9. Marcar evento como processado
    await runQueryWithTenant(
      tenantId,
      `UPDATE events SET split_processed = true, split_processed_at = now() WHERE id = $1`,
      [eventId]
    );

    console.log(`[PostEventSplit] Concluído para evento ${eventId}`);
  }

  /**
   * Distribui saldo restante (organizador + splits)
   * CONTRATO v1.3: Split padrão após pagar participantes
   */
  private async distributeRemainder(tenantId: string, eventId: string, event: EventRow): Promise<void> {
    // Buscar saldo restante
    const escrow = await escrowService.getEscrowByEvent(tenantId, eventId);
    if (!escrow || escrow.current_balance_cents <= 0) {
      return;
    }

    const remainder = escrow.current_balance_cents;

    // Resolver contas
    const organizerAccount = await this.resolveOrganizerAccount(tenantId, event.actor_id, event.actor_type);
    if (!organizerAccount) {
      console.warn(`[PostEventSplit] Organizador sem conta, pulando split`);
      return;
    }

    // Split padrão: 70% organizador, 15% cidade, 10% região, 5% grupo
    // Por enquanto, vamos usar split engine para calcular
    const splitContext = {
      tenantId,
      amountCents: remainder / 100, // Converter para reais
      currency: 'BRL' as const,
      source: 'event_ticket',
      customerAccountId: organizerAccount, // Conta de origem (escrow)
      eventOrganizerAccountId: organizerAccount,
      metadata: {
        module: 'EVENT_TICKET',
        eventId: event.id,
        postEvent: true,
      },
    };

    const splitResult = splitEngineService.calculateSplits(splitContext);

    // Liberar cada split do escrow
    for (const split of splitResult.splits) {
      if (split.amount <= 0) continue;

      // Resolver conta de destino baseado no targetType
      let destinationAccountId: string | null = null;

      if (split.rule.targetType === 'EVENT_ORGANIZER') {
        destinationAccountId = organizerAccount;
      } else {
        // Para outros destinos (TENANT, REGION, GROUP), precisamos resolver contas
        // Por enquanto, vamos usar a conta do organizador como fallback
        // TODO: Implementar resolução completa de contas
        destinationAccountId = organizerAccount;
      }

      if (destinationAccountId) {
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId,
          amountCents: Math.floor(split.amount * 100), // Converter para centavos
          reason: split.rule.targetType,
          idempotencyKey: `split-${eventId}-${split.rule.targetType}-${uuidv4()}`,
        });
      }
    }
  }

  /**
   * Processa no-shows de compradores
   * CONTRATO v1.3: Comprador que não vai perde ingresso
   */
  private async processBuyerNoShows(tenantId: string, eventId: string): Promise<void> {
    const noShowBuyers = await runQueriesWithTenant<{ actor_id: string }>(
      tenantId,
      `
      SELECT DISTINCT ea.actor_id
      FROM event_attendees ea
      WHERE ea.tenant_id = $1
        AND ea.event_id = $2
        AND ea.check_in_status = 'pending'
      `,
      [tenantId, eventId]
    );

    for (const buyer of noShowBuyers) {
      await penaltyService.processBuyerNoShow(tenantId, eventId, buyer.actor_id);
    }
  }

  /**
   * Obtém evento
   */
  private async getEvent(tenantId: string, eventId: string): Promise<EventRow | null> {
    return (
      (await runQueryWithTenant<EventRow>(
        tenantId,
        `SELECT id, tenant_id, actor_id, actor_type, event_type, ticket_price_cents, datetime_start, datetime_end, status
         FROM events
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, eventId]
      )) || null
    );
  }

  /**
   * Obtém participantes com attendance_status
   * CONTRATO v1.4: Usa attendance_status calculado automaticamente
   */
  private async getParticipantsWithCheckIn(tenantId: string, eventId: string): Promise<EventParticipant[]> {
    const results = await runQueriesWithTenant<EventParticipant>(
      tenantId,
      `
      SELECT 
        ep.id,
        ep.actor_id,
        ep.actor_type,
        ep.role,
        ep.responsibility_level,
        ep.agreed_amount_cents,
        ep.expected_headcount,
        COALESCE(ci.checked_in_count, 0) as checked_in_count,
        COALESCE(ep.attendance_status, 'NO_SHOW')::VARCHAR(20) as attendance_status,
        a.account_id
      FROM event_participants ep
      LEFT JOIN accounts a ON a.owner_id = ep.actor_id 
        AND a.owner_type = CASE 
          WHEN ep.actor_type = 'user' THEN 'user'
          WHEN ep.actor_type = 'page' THEN 'merchant'
          ELSE 'user'
        END
      LEFT JOIN (
        SELECT participant_id, COUNT(*) as checked_in_count
        FROM event_check_ins
        WHERE event_id = $2
        GROUP BY participant_id
      ) ci ON ci.participant_id = ep.id
      WHERE ep.tenant_id = $1 AND ep.event_id = $2
      `,
      [tenantId, eventId]
    );

    return results || [];
  }

  /**
   * Resolve conta do organizador
   */
  private async resolveOrganizerAccount(
    tenantId: string,
    actorId: string,
    actorType: string
  ): Promise<string | null> {
    const accounts = await accountService.getAccountsByOwner(
      tenantId,
      actorId,
      actorType === 'user' ? 'user' : 'merchant'
    );

    return accounts.length > 0 ? accounts[0].accountId : null;
  }
}

export const postEventSplitJob = new PostEventSplitJob();


