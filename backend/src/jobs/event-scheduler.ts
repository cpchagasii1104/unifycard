// src/jobs/event-scheduler.ts
// Scheduler de eventos (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Jobs automáticos para gerenciar ciclo de vida de eventos

import { postEventSplitJob } from './post-event-split.job';
import { pool } from '@core/database/pool';

interface EventRow {
  id: string;
  tenant_id: string;
  datetime_start: Date;
  datetime_end: Date | null;
  status: string;
}

class EventScheduler {
  /**
   * Roda a cada hora
   * Processa eventos que terminaram (events.status = 'ended')
   * Estado da execução financeira pós-evento vive em event_financial_execution
   * (separado de events conforme migration soberana 20260525100000 — §4.38).
   */
  async processEndedEvents(): Promise<void> {
    console.log('[EventScheduler] Verificando eventos finalizados...');

    // Estado de execução financeira pós-evento: event_financial_execution (não events.split_processed).
    // Enfileira trabalho para eventos ended com janela em datetime_end.
    await pool.query(`
      INSERT INTO event_financial_execution (tenant_id, event_id, status)
      SELECT e.tenant_id, e.id, 'pending'
      FROM events e
      WHERE e.status = 'ended'
        AND e.datetime_end IS NOT NULL
        AND e.datetime_end < now()
        AND e.datetime_end > now() - INTERVAL '2 hours'
      ON CONFLICT (tenant_id, event_id) DO NOTHING
    `);

    const result = await pool.query<EventRow>(
      `
      SELECT e.id, e.tenant_id
      FROM events e
      INNER JOIN event_financial_execution efe
        ON efe.tenant_id = e.tenant_id AND efe.event_id = e.id
      WHERE e.status = 'ended'
        AND e.datetime_end IS NOT NULL
        AND e.datetime_end < now()
        AND e.datetime_end > now() - INTERVAL '2 hours'
        AND efe.status = 'pending'
      `
    );
    const events = result.rows;

    for (const event of events || []) {
      try {
        await postEventSplitJob.execute(event.tenant_id, event.id);
      } catch (error) {
        console.error(`[EventScheduler] Erro ao processar evento ${event.id}:`, error);
      }
    }
  }

  /**
   * Roda 30 min antes do evento
   * Bloqueia o escrow
   * CONTRATO v1.3: Nenhum saque antes do evento
   */
  async lockUpcomingEvents(): Promise<void> {
    console.log('[EventScheduler] Bloqueando escrow de eventos próximos...');

    const result = await pool.query<EventRow>(
      `
      SELECT e.id, e.tenant_id 
      FROM events e
      JOIN event_escrow es ON es.event_id = e.id
      WHERE e.datetime_start < now() + INTERVAL '30 minutes'
        AND e.datetime_start > now()
        AND es.status = 'COLLECTING'
      `
    );
    const events = result.rows;

    const { escrowService } = await import('../modules/escrow/escrow.service');
    for (const event of events || []) {
      try {
        await escrowService.lock(event.tenant_id, event.id);
      } catch (error) {
        console.error(`[EventScheduler] Erro ao bloquear escrow ${event.id}:`, error);
      }
    }
  }

  /**
   * Expira penalidades antigas
   * CONTRATO v1.3: Penalidades temporárias expiram automaticamente
   */
  async expirePenalties(): Promise<void> {
    console.log('[EventScheduler] Expirando penalidades antigas...');

    // Expirar penalidades antigas (query global)
    await pool.query(
      `
      UPDATE actor_penalties 
      SET status = 'expired', resolved_at = now()
      WHERE status = 'active' 
        AND ends_at < now()
      `
    );
  }

  /**
   * Processa débitos vencidos
   * CONTRATO v1.3: Débito não pago em 7 dias passa para organizador
   * CONTRATO v1.4: Usa due_at em vez de created_at
   */
  async processOverdueDebts(): Promise<void> {
    console.log('[EventScheduler] Processando débitos vencidos...');

    // Buscar débitos pendentes vencidos (due_at < now())
    const { penaltyService } = await import('@core/reputation/penalty.service');
    
    const result = await pool.query<{
      id: string;
      tenant_id: string;
      event_id: string;
      debtor_actor_id: string;
      debtor_actor_type: string;
      amount_cents: number;
      guarantor_actor_id: string;
      guarantor_actor_type: string;
    }>(
      `
      SELECT ad.id, ad.tenant_id, ad.event_id, ad.debtor_actor_id, ad.debtor_actor_type,
             ad.amount_cents, ad.guarantor_actor_id, ad.guarantor_actor_type
      FROM actor_debts ad
      WHERE ad.status = 'pending'
        AND ad.due_at < now()
        AND ad.guarantor_actor_id IS NOT NULL
      `
    );
    const debts = result.rows;

    for (const debt of debts || []) {
      try {
        // Transferir débito para garantidor (organizador)
        await pool.query(
          `
          UPDATE actor_debts
          SET status = 'TRANSFERRED_TO_ORGANIZER',
              transferred_at = now(),
              metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{transferred_from}',
                to_jsonb(debtor_actor_id)
              )
          WHERE id = $1
          `,
          [debt.id]
        );

        // Aplicar penalidade ao devedor original
        await penaltyService.applyPenalty(
          debt.tenant_id,
          debt.debtor_actor_id,
          debt.debtor_actor_type as 'user' | 'page',
          'LATE_CANCEL',
          debt.event_id,
          { debtId: debt.id, transferred: true }
        );

        // CONTRATO v1.4: Bloquear conta do devedor se débito não pago
        await this.blockAccountForDebt(
          debt.tenant_id,
          debt.debtor_actor_id,
          debt.debtor_actor_type,
          debt.id
        );
      } catch (error) {
        console.error(`[EventScheduler] Erro ao processar débito ${debt.id}:`, error);
      }
    }
  }

  /**
   * Job diário de escalação de débitos vencidos
   * CONTRATO v1.4/Fase10: Aplica penalty de score (-20) e bloqueia actor com débito vencido
   */
  async dailyDebtEscalationJob(): Promise<void> {
    console.log('[EventScheduler] Executando escalação diária de débitos vencidos...');

    const { penaltyService } = await import('@core/reputation/penalty.service');
    
    // Buscar débitos vencidos (status PENDING AND now() > due_at)
    const result = await pool.query<{
      id: string;
      tenant_id: string;
      event_id: string;
      debtor_actor_id: string;
      debtor_actor_type: string;
      amount_cents: number;
    }>(
      `
      SELECT ad.id, ad.tenant_id, ad.event_id, ad.debtor_actor_id, ad.debtor_actor_type,
             ad.amount_cents
      FROM actor_debts ad
      WHERE ad.status = 'pending'
        AND ad.due_at < now()
      `
    );
    const overdueDebts = result.rows;

    for (const debt of overdueDebts || []) {
      try {
        // Aplicar penalty de score (-20) por débito vencido
        await penaltyService.updateScore(
          debt.tenant_id,
          debt.debtor_actor_id,
          debt.debtor_actor_type as 'user' | 'page',
          -20,
          'OVERDUE_DEBT',
          debt.event_id,
          { debtId: debt.id, amountCents: debt.amount_cents }
        );

        // Bloqueio já é aplicado automaticamente via hasPendingDebts no canPerformAction
        // Não precisa criar penalidade adicional, pois o débito PENDING já bloqueia
        console.log(
          `[EventScheduler] Penalty aplicado para débito vencido: ${debt.id} (actor: ${debt.debtor_actor_id})`
        );
      } catch (error) {
        console.error(`[EventScheduler] Erro ao escalar débito ${debt.id}:`, error);
      }
    }

    console.log(`[EventScheduler] Escalação concluída: ${overdueDebts.length} débitos processados`);
  }

  /**
   * Bloqueia conta de ator com débito não pago
   * CONTRATO v1.4: Conta bloqueada até quitação
   */
  private async blockAccountForDebt(
    tenantId: string,
    actorId: string,
    actorType: string,
    debtId: string
  ): Promise<void> {
    // Verificar se há débitos pendentes.
    // CHECK chk_actor_debts_status aceita 'pending' (lowercase) — alinhado a §4.11.
    // (Antes: status = 'PENDING' UPPERCASE → dead branch em runtime, nunca match.)
    const pendingDebts = await pool.query<{ total_cents: string }>(
      `
      SELECT COALESCE(SUM(amount_cents), 0)::bigint as total_cents
      FROM actor_debts
      WHERE tenant_id = $1
        AND debtor_actor_id = $2
        AND debtor_actor_type = $3
        AND status = 'pending'
      `,
      [tenantId, actorId, actorType]
    );

    const totalDebt = parseInt(String(pendingDebts.rows[0]?.total_cents ?? '0'), 10);

    if (totalDebt > 0) {
      // Aplicar penalidade de bloqueio
      const { penaltyService } = await import('@core/reputation/penalty.service');
      await penaltyService.applyPenalty(
        tenantId,
        actorId,
        actorType as 'user' | 'page',
        'FRAUD',
        undefined,
        { debtId, totalDebt, reason: 'UNPAID_DEBT' }
      );
    }
  }
}

export const eventScheduler = new EventScheduler();


