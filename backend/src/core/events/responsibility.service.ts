// src/core/events/responsibility.service.ts
// Serviço de Responsabilização em Cascata (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Quem causou falha paga. Organizador é garantidor final.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { escrowService } from '@core/economy/escrow.service';
import { penaltyService } from '@core/reputation/penalty.service';
import { accountService } from '@core/economy/accounts/account.service';
import { BadRequestError, NotFoundError } from '@core/errors';
import { v4 as uuidv4 } from 'uuid';

interface ParticipantRow {
  id: string;
  actor_id: string;
  actor_type: string;
  role: string;
  responsibility_level: number;
  agreed_amount_cents: number;
  expected_headcount: number;
  attendance_status: 'PRESENT' | 'LEFT_EARLY' | 'NO_SHOW' | null;
  account_id: string | null;
}

interface CheckInRow {
  participant_id: string;
  checked_in_count: number;
}

/**
 * Processa responsabilização em cascata quando evento falha
 * CONTRATO v1.3: Quem causou falha paga quem cumpriu
 */
export class ResponsibilityService {
  /**
   * Processa cancelamento de evento com responsabilização
   * CONTRATO v1.3: Cadeia de responsabilidade automática
   */
  async processEventCancellation(
    tenantId: string,
    eventId: string,
    cancellationReason: 'ORGANIZER' | 'MAIN_ATTRACTION_NO_SHOW' | 'FORCE_MAJEURE',
    hoursBeforeEvent: number
  ): Promise<void> {
    // 1. Identificar causador
    const event = await runQueryWithTenant<{
      id: string;
      actor_id: string;
      actor_type: string;
      ticket_price_cents: number | null;
    }>(
      tenantId,
      `SELECT id, actor_id, actor_type, ticket_price_cents FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 2. Identificar quem cumpriu (attendance_status = PRESENT ou LEFT_EARLY)
    const participants = await this.getParticipantsWithCheckIn(tenantId, eventId);
    const fulfilledParticipants = participants.filter(
      (p) => p.attendance_status === 'PRESENT' || p.attendance_status === 'LEFT_EARLY'
    );

    // 3. Calcular débito do causador
    let causatorActorId: string;
    let causatorActorType: 'user' | 'page';

    if (cancellationReason === 'MAIN_ATTRACTION_NO_SHOW') {
      // Buscar atração principal (responsibility_level = 1)
      const mainAttraction = participants.find((p) => p.responsibility_level === 1);
      if (!mainAttraction) {
        throw new BadRequestError('Atração principal não encontrada');
      }
      causatorActorId = mainAttraction.actor_id;
      causatorActorType = mainAttraction.actor_type as 'user' | 'page';
    } else if (cancellationReason === 'ORGANIZER') {
      causatorActorId = event.actorId;
      causatorActorType = event.actorType as 'user' | 'page';
    } else {
      // Força maior: ninguém é causador
      // Apenas reembolsar compradores e pagar quem cumpriu do escrow
      await this.processForceMajeure(tenantId, eventId, fulfilledParticipants);
      return;
    }

    // 4. Calcular total a pagar (quem cumpriu)
    const totalDebtCents = fulfilledParticipants.reduce(
      (sum, p) => sum + p.agreed_amount_cents,
      0
    );

    // 5. Pagar quem cumpriu do escrow (se houver)
    const escrow = await escrowService.getEscrowByEvent(tenantId, eventId);
    if (escrow && escrow.current_balance_cents > 0) {
      // Pagar do escrow primeiro
      for (const participant of fulfilledParticipants) {
        if (!participant.account_id) continue;

        const amountToPay = Math.min(
          participant.agreed_amount_cents,
          escrow.current_balance_cents
        );

        if (amountToPay > 0) {
          await escrowService.release(tenantId, {
            eventId,
            destinationAccountId: participant.account_id,
            amountCents: amountToPay,
            participantId: participant.id,
            reason: 'CANCELLATION_PROTECTION',
            idempotencyKey: `cancel-protect-${eventId}-${participant.id}-${uuidv4()}`,
          });
        }
      }
    }

    // 6. Registrar débito do causador
    // CONTRATO v1.4: Se causador não tiver saldo, débito vai para organizador
    for (const participant of fulfilledParticipants) {
      if (!participant.account_id) continue;

      const amountOwed = participant.agreed_amount_cents;
      const escrowPaid = Math.min(amountOwed, escrow?.current_balance_cents || 0);
      const remainingDebt = amountOwed - escrowPaid;

      if (remainingDebt > 0) {
        // Verificar saldo do causador
        const causatorAccount = await accountService.getAccountsByOwner(
          tenantId,
          causatorActorId,
          causatorActorType === 'user' ? 'user' : 'merchant'
        );

        const causatorBalance = causatorAccount.length > 0 ? causatorAccount[0].balance : 0;
        const causatorBalanceCents = Math.floor(causatorBalance * 100);

        // Se causador não tem saldo suficiente, débito vai para organizador
        if (causatorBalanceCents < remainingDebt) {
          await this.createDebt(tenantId, {
            eventId,
            debtorActorId: event.actorId, // Organizador recebe débito
            debtorActorType: event.actorType as 'user' | 'page',
            creditorActorId: participant.actor_id,
            creditorActorType: participant.actor_type as 'user' | 'page',
            amountCents: remainingDebt,
            reason: 'CANCELLATION',
            guarantorActorId: event.actorId, // Organizador é garantidor final
            guarantorActorType: event.actorType as 'user' | 'page',
            metadata: { originalDebtor: causatorActorId, transferred: true },
          });

          // Bloquear conta do causador original
          const { penaltyService } = await import('@core/reputation/penalty.service');
          await penaltyService.applyPenalty(
            tenantId,
            causatorActorId,
            causatorActorType,
            'FRAUD',
            eventId,
            { reason: 'INSUFFICIENT_BALANCE_FOR_DEBT', debtAmount: remainingDebt }
          );
        } else {
          // Causador tem saldo, débito fica com ele
          await this.createDebt(tenantId, {
            eventId,
            debtorActorId: causatorActorId,
            debtorActorType: causatorActorType,
            creditorActorId: participant.actor_id,
            creditorActorType: participant.actor_type as 'user' | 'page',
            amountCents: remainingDebt,
            reason: 'CANCELLATION',
            guarantorActorId: event.actorId, // Organizador é garantidor
            guarantorActorType: event.actorType as 'user' | 'page',
          });
        }
      }
    }

    // 7. Aplicar penalidades
    if (cancellationReason === 'MAIN_ATTRACTION_NO_SHOW') {
      await penaltyService.processMainAttractionNoShow(
        tenantId,
        eventId,
        causatorActorId,
        causatorActorType
      );
    } else if (cancellationReason === 'ORGANIZER') {
      await penaltyService.processEventCancellation(
        tenantId,
        eventId,
        causatorActorId,
        causatorActorType,
        hoursBeforeEvent
      );
    }

    // 8. Reembolsar compradores
    await this.refundAllBuyers(tenantId, eventId);
  }

  /**
   * Processa força maior (ninguém é causador)
   * CONTRATO v1.3: Fundo paga proporcional
   */
  private async processForceMajeure(
    tenantId: string,
    eventId: string,
    fulfilledParticipants: ParticipantRow[]
  ): Promise<void> {
    const escrow = await escrowService.getEscrowByEvent(tenantId, eventId);
    if (!escrow || escrow.current_balance_cents <= 0) {
      return;
    }

    // Pagar proporcionalmente do escrow (50-70% do acordado)
    const totalAgreed = fulfilledParticipants.reduce((sum, p) => sum + p.agreed_amount_cents, 0);
    const paymentRate = 0.6; // 60% do acordado

    for (const participant of fulfilledParticipants) {
      if (!participant.account_id) continue;

      const amountToPay = Math.floor(participant.agreed_amount_cents * paymentRate);
      const availableAmount = Math.min(amountToPay, escrow.current_balance_cents);

      if (availableAmount > 0) {
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId: participant.account_id,
          amountCents: availableAmount,
          participantId: participant.id,
          reason: 'FORCE_MAJEURE',
          idempotencyKey: `force-majeure-${eventId}-${participant.id}-${uuidv4()}`,
        });
      }
    }
  }

  /**
   * Reembolsa todos os compradores
   * CONTRATO v1.3: Comprador nunca perde dinheiro
   */
  private async refundAllBuyers(tenantId: string, eventId: string): Promise<void> {
    const buyers = await runQueriesWithTenant<{ id: string }>(
      tenantId,
      `
      SELECT id FROM event_attendees
      WHERE tenant_id = $1 AND event_id = $2
        AND check_in_status = 'pending'
      `,
      [tenantId, eventId]
    );

    for (const buyer of buyers || []) {
      try {
        await escrowService.refund(tenantId, {
          eventId,
          ticketId: buyer.id,
          idempotencyKey: `refund-${eventId}-${buyer.id}-${uuidv4()}`,
          reason: 'EVENT_CANCELLED',
        });
      } catch (error) {
        console.error(`[ResponsibilityService] Erro ao reembolsar comprador ${buyer.id}:`, error);
      }
    }
  }

  /**
   * Cria débito de responsabilização
   * CONTRATO v1.3: Débito registrado para cobrança
   * CONTRATO v1.4: Inclui dueAt (SLA de 7 dias) e metadata completa
   */
  private async createDebt(
    tenantId: string,
    params: {
      eventId: string;
      debtorActorId: string;
      debtorActorType: 'user' | 'page';
      creditorActorId: string;
      creditorActorType: 'user' | 'page';
      amountCents: number;
      reason: 'NO_SHOW' | 'CANCELLATION' | 'PARTIAL_DELIVERY' | 'LATE_CANCELLATION';
      guarantorActorId: string;
      guarantorActorType: 'user' | 'page';
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    // Metadata completa conforme CONTRATO v1.4
    const fullMetadata = {
      source_event_id: params.eventId,
      reason_code: params.reason,
      caused_by_actor_id: params.debtorActorId,
      ...(params.metadata || {}),
    };

    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO actor_debts (
        tenant_id, event_id,
        debtor_actor_id, debtor_actor_type,
        creditor_actor_id, creditor_actor_type,
        amount_cents, reason, status,
        guarantor_actor_id, guarantor_actor_type,
        dueAt, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, now() + INTERVAL '7 days', $11)
      `,
      [
        tenantId,
        params.eventId,
        params.debtorActorId,
        params.debtorActorType,
        params.creditorActorId,
        params.creditorActorType,
        params.amountCents,
        params.reason,
        params.guarantorActorId,
        params.guarantorActorType,
        JSON.stringify(fullMetadata),
      ]
    );
  }

  /**
   * Obtém participantes com attendance_status
   * CONTRATO v1.4: Usa attendance_status calculado automaticamente
   */
  private async getParticipantsWithCheckIn(
    tenantId: string,
    eventId: string
  ): Promise<ParticipantRow[]> {
    const participants = await runQueriesWithTenant<ParticipantRow>(
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
        COALESCE(ep.attendance_status, 'NO_SHOW')::VARCHAR(20) as attendance_status,
        a.account_id
      FROM event_participants ep
      LEFT JOIN accounts a ON a.owner_id = ep.actor_id 
        AND a.owner_type = CASE 
          WHEN ep.actor_type = 'user' THEN 'user'
          WHEN ep.actor_type = 'page' THEN 'merchant'
          ELSE 'user'
        END
      WHERE ep.tenant_id = $1 AND ep.event_id = $2
      `,
      [tenantId, eventId]
    );

    return participants || [];
  }
}

export const responsibilityService = new ResponsibilityService();


