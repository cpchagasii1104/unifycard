// src/jobs/post-event-split.job.ts
// Job de Split Pós-Evento (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Split só ocorre após evento, baseado em check-ins

import { penaltyService } from '@core/reputation/penalty.service';
import { splitEngineService } from '@core/economy/split.service';
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

    const { escrowService } = await import('../modules/escrow/escrow.service');

    // 1. Verificar se evento já foi processado
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      console.log(`[PostEventSplit] Evento não encontrado`);
      return;
    }

    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO event_financial_execution (tenant_id, event_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (tenant_id, event_id) DO NOTHING
      `,
      [tenantId, eventId]
    );

    // Reivindicar linha de execução financeira (idempotente; evita dual state em events)
    //
    // ⚠️ DT-EVENT-FINANCIAL-EXECUTION-ORPHAN-RECOVERY (REMEDIATION_DT_LOG.md, registrada 2026-05-18)
    // Risco LATENTE: se job crashar entre claim (status='processing') e .complete final,
    // status fica 'processing' permanente. Próxima execução do cron NÃO reentra (claim só
    // pega 'pending'). Pagamentos parciais persistem sem recovery automático.
    // Hoje INATIVO: escrowService.release é stub (no-op em runtime). Vira ATIVO quando
    // event-escrow for implementado.
    // Mitigação prevista (ADIADA por decisão Clayton 2026-05-18): processing_started_at
    // + reclaim timeout em worker dedicado. NÃO improvisar — risco de replay financeiro
    // em job parcialmente liquidado. Fix obrigatório antes de produção em escala real.
    const claimed = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      UPDATE event_financial_execution efe
      SET status = 'processing', updated_at = now()
      FROM events e
      WHERE e.id = efe.event_id
        AND e.tenant_id = efe.tenant_id
        AND e.tenant_id = $1
        AND efe.event_id = $2
        AND efe.status = 'pending'
      RETURNING efe.id
      `,
      [tenantId, eventId]
    );

    if (!claimed) {
      const row = await runQueryWithTenant<{ status: string }>(
        tenantId,
        `SELECT status FROM event_financial_execution WHERE tenant_id = $1 AND event_id = $2`,
        [tenantId, eventId]
      );
      if (row?.status === 'completed') {
        console.log(`[PostEventSplit] Evento já processado`);
      }
      return;
    }

    // 2. Verificar que evento está ended e já passou datetime_end (HARD LOCK)
    if (event.status !== 'ended' || !event.datetime_end || new Date(event.datetime_end) > new Date()) {
      await runQueryWithTenant(
        tenantId,
        `UPDATE event_financial_execution SET status = 'pending', updated_at = now()
         WHERE tenant_id = $1 AND event_id = $2 AND status = 'processing'`,
        [tenantId, eventId]
      );
      console.log(`[PostEventSplit] Evento não está ended ou ainda não passou datetime_end, aguardando...`);
      return;
    }

    try {
    // 3. Iniciar liberação do escrow (HARD LOCK: só após ended + datetime_end)
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
        // PASSO 6b auditoria 2026-05-18 (R1): idempotencyKey DETERMINÍSTICO.
        // Anterior: `split-${eventId}-${participant.id}-${uuidv4()}` quebrava idempotência
        // (cada retry gerava key nova). Hoje escrowService.release é stub (no-op);
        // quando event-escrow for implementado, esta chave determinística previne double payout.
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId: participant.account_id,
          amountCents: adjustedAmount,
          participantId: participant.id,
          reason: `PARTICIPANT_PAYMENT_${participant.role}_${status}`,
          idempotencyKey: `split-${eventId}-${participant.id}`,
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

    // 9. Marcar execução financeira como concluída
    await runQueryWithTenant(
      tenantId,
      `UPDATE event_financial_execution
       SET status = 'completed', processed_at = now(), updated_at = now(), error_message = NULL
       WHERE tenant_id = $1 AND event_id = $2`,
      [tenantId, eventId]
    );

    console.log(`[PostEventSplit] Concluído para evento ${eventId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 2000) : String(err).slice(0, 2000);
      await runQueryWithTenant(
        tenantId,
        `UPDATE event_financial_execution
         SET status = 'failed', error_message = $3, updated_at = now()
         WHERE tenant_id = $1 AND event_id = $2 AND status = 'processing'`,
        [tenantId, eventId, msg]
      );
      console.error(`[PostEventSplit] Falha para evento ${eventId}:`, err);
      throw err;
    }
  }

  /**
   * Distribui saldo restante (organizador + splits)
   * CONTRATO v1.3: Split padrão após pagar participantes
   */
  private async distributeRemainder(tenantId: string, eventId: string, event: EventRow): Promise<void> {
    const { escrowService } = await import('../modules/escrow/escrow.service');
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
      amountCents: remainder,
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
      if (split.amountCents <= 0) continue;

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
        // PASSO 6b auditoria 2026-05-18 (R1): idempotencyKey DETERMINÍSTICO.
        // Mesmo fix da chamada de release por participante: previne double payout
        // quando event-escrow for implementado.
        await escrowService.release(tenantId, {
          eventId,
          destinationAccountId,
          amountCents: split.amountCents,
          reason: split.rule.targetType,
          idempotencyKey: `split-${eventId}-remainder-${split.rule.targetType}`,
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
    const { accountService } = await import('../core/economy/account.service');
    const accounts = await accountService.getAccountsByOwner(
      tenantId,
      actorId,
      actorType === 'user' ? 'user' : 'company'
    );

    return accounts.length > 0 ? accounts[0].accountId : null;
  }
}

export const postEventSplitJob = new PostEventSplitJob();


