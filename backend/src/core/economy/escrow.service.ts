// src/core/economy/escrow.service.ts
// Serviço de Escrow (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
//
// REGRA ABSOLUTA: Todo dinheiro de evento vai para ESCROW
// Nenhum saque antes do evento
// Split só ocorre após evento ou cancelamento justificado

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { BadRequestError, NotFoundError } from '@core/errors';
import { v4 as uuidv4 } from 'uuid';

export interface EscrowDeposit {
  eventId: string;
  sourceAccountId: string;
  amountCents: number;
  ticketId?: string; // event_attendees.id
  idempotencyKey: string;
}

export interface EscrowRelease {
  eventId: string;
  destinationAccountId: string;
  amountCents: number;
  participantId?: string; // event_participants.id
  reason: string;
  idempotencyKey: string;
}

export interface EscrowRefund {
  eventId: string;
  ticketId: string; // event_attendees.id
  idempotencyKey: string;
  reason?: string;
}

interface EscrowRow {
  id: string;
  tenant_id: string;
  event_id: string;
  total_collected_cents: number;
  total_released_cents: number;
  total_refunded_cents: number;
  current_balance_cents: number;
  status: 'COLLECTING' | 'LOCKED' | 'RELEASING' | 'COMPLETED' | 'REFUNDING';
  lockedAt: Date | null;
  release_startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EscrowTransactionRow {
  id: string;
  tenant_id: string;
  escrow_id: string;
  transaction_type: 'DEPOSIT' | 'RELEASE' | 'REFUND' | 'PENALTY';
  amount_cents: number;
  source_account_id: string | null;
  destination_account_id: string | null;
  ticket_id: string | null;
  participant_id: string | null;
  reason: string | null;
  metadata: any;
  idempotency_key: string;
  createdAt: Date;
}

class EscrowService {
  /**
   * Cria escrow para evento (chamado na publicação)
   * CONTRATO v1.3: Escrow obrigatório para eventos pagos
   */
  async createEscrow(tenantId: string, eventId: string): Promise<void> {
    const existing = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `SELECT id FROM event_escrow WHERE event_id = $1`,
      [eventId]
    );

    if (existing) {
      return; // Já existe, não criar duplicado
    }

    await runQueryWithTenant(
      tenantId,
      `INSERT INTO event_escrow (tenant_id, event_id, status)
       VALUES ($1, $2, 'COLLECTING')
       ON CONFLICT (event_id) DO NOTHING`,
      [tenantId, eventId]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.created',
      payload: { eventId },
    });
  }

  /**
   * Deposita valor no escrow (compra de ingresso)
   * CONTRATO v1.3: Todo dinheiro de compra vai para escrow
   */
  async deposit(tenantId: string, params: EscrowDeposit): Promise<void> {
    const { eventId, sourceAccountId, amountCents, ticketId, idempotencyKey } = params;

    // Verificar idempotência
    const existing = await this.getTransactionByKey(tenantId, idempotencyKey);
    if (existing) {
      return; // Já processado
    }

    // Buscar escrow
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new NotFoundError('Escrow não encontrado para este evento');
    }
    if (escrow.status !== 'COLLECTING') {
      throw new BadRequestError(`Escrow não está aceitando depósitos (status: ${escrow.status})`);
    }

    // Registrar transação
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO event_escrow_transactions 
       (tenant_id, escrow_id, transaction_type, amount_cents, source_account_id, ticket_id, idempotency_key)
       VALUES ($1, $2, 'DEPOSIT', $3, $4, $5, $6)`,
      [tenantId, escrow.id, amountCents, sourceAccountId, ticketId || null, idempotencyKey]
    );

    // Atualizar saldo
    await runQueryWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET total_collected_cents = total_collected_cents + $1, updatedAt = now()
       WHERE id = $2`,
      [amountCents, escrow.id]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.deposit',
      payload: { eventId, amountCents: amountCents, ticketId },
    });
  }

  /**
   * Bloqueia escrow (30 min antes do evento)
   * CONTRATO v1.3: Nenhum saque antes do evento
   */
  async lock(tenantId: string, eventId: string): Promise<void> {
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new NotFoundError('Escrow não encontrado');
    }

    if (escrow.status !== 'COLLECTING') {
      // Já está bloqueado ou em outro estado
      return;
    }

    await runQueryWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET status = 'LOCKED', lockedAt = now(), updatedAt = now()
       WHERE event_id = $1 AND status = 'COLLECTING'`,
      [eventId]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.locked',
      payload: { eventId },
    });
  }

  /**
   * Inicia liberação (pós-evento)
   * CONTRATO v1.3: Split só ocorre após evento
   */
  async startRelease(tenantId: string, eventId: string): Promise<void> {
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new NotFoundError('Escrow não encontrado');
    }

    if (escrow.status !== 'LOCKED') {
      throw new BadRequestError(`Escrow não está bloqueado (status: ${escrow.status})`);
    }

    await runQueryWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET status = 'RELEASING', release_startedAt = now(), updatedAt = now()
       WHERE event_id = $1 AND status = 'LOCKED'`,
      [eventId]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.release.started',
      payload: { eventId },
    });
  }

  /**
   * Libera valor do escrow (pagamento pós-evento)
   * CONTRATO v1.4: HARD LOCK - Só libera se evento está COMPLETED e escrow está RELEASING
   * PROIBIDO: Liberação manual
   */
  async release(tenantId: string, params: EscrowRelease): Promise<void> {
    const { eventId, destinationAccountId, amountCents, participantId, reason, idempotencyKey } = params;

    // Verificar idempotência
    const existing = await this.getTransactionByKey(tenantId, idempotencyKey);
    if (existing) {
      return; // Já processado
    }

    // HARD LOCK: Verificar que evento está COMPLETED
    const event = await runQueryWithTenant<{ status: string; completedAt: Date | null }>(
      tenantId,
      `SELECT status, completedAt FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    if (event.status !== 'completed') {
      throw new BadRequestError(`HARD LOCK: Evento deve estar COMPLETED para liberar escrow. Status atual: ${event.status}. Liberação manual proibida.`);
    }

    if (!event.completedAt) {
      throw new BadRequestError('HARD LOCK: Evento deve ter completedAt definido');
    }

    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new NotFoundError('Escrow não encontrado');
    }

    // HARD LOCK: Verificar que escrow está RELEASING (não permite release manual)
    if (escrow.status !== 'RELEASING') {
      throw new BadRequestError(`HARD LOCK: Escrow deve estar em RELEASING para liberar. Status atual: ${escrow.status}. Liberação manual proibida.`);
    }

    if (escrow.current_balance_cents < amountCents) {
      throw new BadRequestError(`Saldo insuficiente no escrow (disponível: ${escrow.current_balance_cents}, solicitado: ${amountCents})`);
    }

    // Registrar transação
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO event_escrow_transactions 
       (tenant_id, escrow_id, transaction_type, amount_cents, destination_account_id, participant_id, reason, idempotency_key)
       VALUES ($1, $2, 'RELEASE', $3, $4, $5, $6, $7)`,
      [tenantId, escrow.id, amountCents, destinationAccountId, participantId || null, reason, idempotencyKey]
    );

    // Atualizar saldo
    await runQueryWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET total_released_cents = total_released_cents + $1, updatedAt = now()
       WHERE id = $2`,
      [amountCents, escrow.id]
    );

    // CONTRATO v1.4: Registrar no Ledger
    const { transactionService } = await import('../economy/transactions/transaction.service');
    const escrowAccountId = await this.getEscrowAccountId(tenantId, eventId);
    
    if (escrowAccountId && destinationAccountId) {
      await transactionService.transfer(tenantId, {
        fromAccount: escrowAccountId,
        toAccount: destinationAccountId,
        amountCents: amountCents / 100, // Converter centavos para reais
        metadata: {
          module: 'EVENT_ESCROW_RELEASE',
          eventId,
          participantId: participantId || null,
          reason,
          source: 'post_event_split',
          transactionId: uuidv4(),
        },
      });
    }

    await eventBus.publish({
      tenantId,
      type: 'escrow.release',
      payload: { eventId, destinationAccountId, amountCents: amountCents, participantId },
    });
  }

  /**
   * Obtém conta de escrow do evento
   */
  private async getEscrowAccountId(tenantId: string, eventId: string): Promise<string | null> {
    // Buscar conta de escrow do evento (criada no checkout)
    const account = await runQueryWithTenant<{ account_id: string }>(
      tenantId,
      `SELECT account_id FROM accounts 
       WHERE tenant_id = $1 
         AND metadata->>'eventId' = $2 
         AND metadata->>'type' = 'escrow'
       LIMIT 1`,
      [tenantId, eventId]
    );
    
    return account?.account_id || null;
  }

  /**
   * Reembolsa valor (cancelamento)
   * CONTRATO v1.3: Comprador nunca perde dinheiro
   */
  async refund(tenantId: string, params: EscrowRefund): Promise<void> {
    const { eventId, ticketId, idempotencyKey, reason } = params;

    // Verificar idempotência
    const existing = await this.getTransactionByKey(tenantId, idempotencyKey);
    if (existing) {
      return; // Já processado
    }

    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new NotFoundError('Escrow não encontrado');
    }

    // Buscar transação original do ticket
    const original = await runQueryWithTenant<EscrowTransactionRow>(
      tenantId,
      `SELECT * FROM event_escrow_transactions 
       WHERE escrow_id = $1 AND ticket_id = $2 AND transaction_type = 'DEPOSIT'
       ORDER BY createdAt DESC
       LIMIT 1`,
      [escrow.id, ticketId]
    );

    if (!original) {
      throw new NotFoundError('Transação original não encontrada para este ticket');
    }

    // Registrar reembolso
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO event_escrow_transactions 
       (tenant_id, escrow_id, transaction_type, amount_cents, destination_account_id, ticket_id, reason, idempotency_key)
       VALUES ($1, $2, 'REFUND', $3, $4, $5, $6, $7)`,
      [
        tenantId,
        escrow.id,
        original.amount_cents,
        original.source_account_id,
        ticketId,
        reason || 'cancelled',
        idempotencyKey,
      ]
    );

    // Atualizar saldo
    await runQueryWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET total_refunded_cents = total_refunded_cents + $1, updatedAt = now()
       WHERE id = $2`,
      [original.amount_cents, escrow.id]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.refund',
      payload: { eventId, ticketId, amountCents: original.amount_cents },
    });
  }

  /**
   * Finaliza escrow
   * CONTRATO v1.3: Tudo distribuído
   */
  async complete(tenantId: string, eventId: string): Promise<void> {
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    if (!escrow) {
      throw new NotFoundError('Escrow não encontrado');
    }

    await runQueryWithTenant(
      tenantId,
      `UPDATE event_escrow 
       SET status = 'COMPLETED', completedAt = now(), updatedAt = now()
       WHERE event_id = $1`,
      [eventId]
    );

    await eventBus.publish({
      tenantId,
      type: 'escrow.completed',
      payload: { eventId },
    });
  }

  /**
   * Obtém escrow por evento
   */
  async getEscrowByEvent(tenantId: string, eventId: string): Promise<EscrowRow | null> {
    return (
      (await runQueryWithTenant<EscrowRow>(
        tenantId,
        `SELECT * FROM event_escrow WHERE event_id = $1`,
        [eventId]
      )) || null
    );
  }

  /**
   * Obtém transação por idempotency key
   */
  private async getTransactionByKey(tenantId: string, key: string): Promise<EscrowTransactionRow | null> {
    return (
      (await runQueryWithTenant<EscrowTransactionRow>(
        tenantId,
        `SELECT * FROM event_escrow_transactions WHERE idempotency_key = $1`,
        [key]
      )) || null
    );
  }

  /**
   * Obtém saldo atual do escrow
   */
  async getBalance(tenantId: string, eventId: string): Promise<number> {
    const escrow = await this.getEscrowByEvent(tenantId, eventId);
    return escrow?.current_balance_cents || 0;
  }
}

export const escrowService = new EscrowService();



