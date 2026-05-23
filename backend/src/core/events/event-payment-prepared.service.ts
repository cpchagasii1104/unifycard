// backend/src/core/events/event-payment-prepared.service.ts
// Event Payment Prepared Service (FASE 6.0)
// FASE_6_MANIFESTO_EXECUCAO_ECONOMICA.md

/**
 * 🔴 PAGAMENTO PREPARADO NÃO É EXECUÇÃO
 * 
 * Pagamento preparado é autorização explícita de intenção de pagamento.
 * 
 * NÃO executa pagamento
 * NÃO libera custódia
 * NÃO move dinheiro
 * 
 * Pagamento só EXISTE como intenção autorizada.
 * 
 * EVENTO CANÔNICO:
 * - event.payment.authorized
 */

import { eventEconomicPhaseService } from './event-economic-phase.service';
import { eventCustodyService } from './event-custody.service';
import { eventSplitDeclarativeService } from './event-split-declarative.service';
import { BadRequestError, NotFoundError } from '@core/errors';
import {
  getClientWithTenant,
  runQueryWithTenant,
  runQueriesWithTenant,
} from '@core/database/pool';
import { insertEventOutboxRow } from './event-outbox.repository';
import { v4 as uuidv4 } from 'uuid';

/**
 * Status da autorização de pagamento
 */
export type PaymentAuthorizationStatus = 'authorized' | 'revoked' | 'executed' | 'cancelled';

/**
 * Input para autorizar pagamento
 */
export interface AuthorizePaymentInput {
  event_id: string;
  custody_id: string;
  split_id: string;
  user_authorization: boolean; // Deve ser true
  authorization_reason?: string; // Opcional: motivo da autorização
}

/**
 * Autorização de pagamento (preparado, não executado)
 */
export interface PaymentAuthorization {
  id: string;
  event_id: string;
  custody_id: string;
  split_id: string;
  tenant_id: string;
  status: PaymentAuthorizationStatus;
  user_authorization: boolean;
  authorization_reason?: string;
  authorizedAt: string;
  updatedAt: string;
  revokedAt?: string;
  executedAt?: string;
  cancelledAt?: string;
}

interface PaymentAuthorizationRow {
  id: string;
  tenant_id: string;
  event_id: string;
  custody_id: string;
  split_id: string;
  status: string;
  user_authorization: boolean;
  authorization_reason: string | null;
  authorized_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
  executed_at: Date | null;
  cancelled_at: Date | null;
}

class EventPaymentPreparedService {
  /**
   * Autoriza pagamento explicitamente
   * 
   * Enfileira `event.payment.authorized` na outbox (mesma TX que o INSERT); publicação efectiva via worker.
   * 
   * NÃO executa pagamento
   * NÃO libera custódia
   * NÃO move dinheiro
   */
  async authorizePayment(
    tenantId: string,
    actorId: string,
    input: AuthorizePaymentInput
  ): Promise<PaymentAuthorization> {
    // 1. Validar autorização do usuário
    if (!input.user_authorization) {
      throw new BadRequestError('Autorização do usuário é obrigatória');
    }

    // 2. Verificar se evento está na Fase 6.0
    const isInEconomicPhase = await eventEconomicPhaseService.isInEconomicPhase(
      tenantId,
      input.event_id
    );
    if (!isInEconomicPhase) {
      throw new BadRequestError(
        'Evento não está na Fase 6.0. Execute o handoff da Fase 5.0 primeiro.'
      );
    }

    // 3. Verificar se custódia existe e está ativa
    const custody = await eventCustodyService.getCustody(tenantId, input.custody_id);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }
    if (custody.event_id !== input.event_id) {
      throw new BadRequestError('Custódia não pertence ao evento');
    }
    if (custody.status !== 'active') {
      throw new BadRequestError(`Custódia não está ativa (status: ${custody.status})`);
    }

    // 4. Verificar se split declarativo existe
    const split = await eventSplitDeclarativeService.getSplit(tenantId, input.split_id);
    if (!split) {
      throw new NotFoundError('Split declarativo não encontrado');
    }
    if (split.event_id !== input.event_id) {
      throw new BadRequestError('Split não pertence ao evento');
    }
    if (split.custody_id !== input.custody_id) {
      throw new BadRequestError('Split não pertence à custódia');
    }
    if (split.status !== 'calculated') {
      throw new BadRequestError(`Split não está calculado (status: ${split.status})`);
    }

    // 5. Verificar se já existe autorização ativa
    const existingAuth = await this.getActiveAuthorization(tenantId, input.event_id);
    if (existingAuth) {
      throw new BadRequestError('Já existe autorização de pagamento ativa para este evento');
    }

    // 6. Criar autorização + linha de outbox (mesma transação)
    const authorizationId = uuidv4();
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      try {
        const insertResult = await client.query<PaymentAuthorizationRow>(
          `
          INSERT INTO event_payment_authorization (
            id, tenant_id, event_id, custody_id, split_id,
            status, user_authorization, authorization_reason,
            authorized_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING *
          `,
          [
            authorizationId,
            tenantId,
            input.event_id,
            input.custody_id,
            input.split_id,
            'authorized',
            input.user_authorization,
            input.authorization_reason || null,
          ]
        );

        const row = insertResult.rows[0];
        if (!row) {
          throw new Error('Falha ao autorizar pagamento');
        }

        const authorization = this.toAuthorization(row);

        await insertEventOutboxRow(client, {
          tenantId,
          eventId: uuidv4(),
          eventType: 'event.payment.authorized',
          eventVersion: 1,
          payload: {
            authorization_id: authorization.id,
            event_id: input.event_id,
            custody_id: input.custody_id,
            split_id: input.split_id,
            actor_id: actorId,
            user_authorization: input.user_authorization,
            authorization_reason: input.authorization_reason,
            authorizedAt: authorization.authorizedAt,
          },
          metadata: {},
        });

        await client.query('COMMIT');
        return authorization;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Revoga autorização de pagamento
   */
  async revokeAuthorization(
    tenantId: string,
    authorizationId: string,
    reason: string
  ): Promise<PaymentAuthorization> {
    // 1. Buscar autorização
    const authorization = await this.getAuthorization(tenantId, authorizationId);
    if (!authorization) {
      throw new NotFoundError('Autorização de pagamento não encontrada');
    }

    // 2. Verificar se pode ser revogada
    if (authorization.status !== 'authorized') {
      throw new BadRequestError(`Autorização não pode ser revogada (status: ${authorization.status})`);
    }

    // 3. Atualizar status
    const row = await runQueryWithTenant<PaymentAuthorizationRow>(
      tenantId,
      `
      UPDATE event_payment_authorization
      SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
      `,
      [authorizationId, tenantId]
    );

    if (!row) {
      throw new Error('Falha ao revogar autorização');
    }

    return this.toAuthorization(row);
  }

  /**
   * Busca autorização por ID
   */
  async getAuthorization(
    tenantId: string,
    authorizationId: string
  ): Promise<PaymentAuthorization | null> {
    const row = await runQueryWithTenant<PaymentAuthorizationRow>(
      tenantId,
      `
      SELECT *
      FROM event_payment_authorization
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [authorizationId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toAuthorization(row);
  }

  /**
   * Busca autorização ativa de um evento
   */
  async getActiveAuthorization(
    tenantId: string,
    eventId: string
  ): Promise<PaymentAuthorization | null> {
    const row = await runQueryWithTenant<PaymentAuthorizationRow>(
      tenantId,
      `
      SELECT *
      FROM event_payment_authorization
      WHERE event_id = $1 AND tenant_id = $2 AND status = 'authorized'
      ORDER BY authorized_at DESC
      LIMIT 1
      `,
      [eventId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toAuthorization(row);
  }

  /**
   * Lista autorizações de um evento
   */
  async listAuthorizationsByEvent(
    tenantId: string,
    eventId: string
  ): Promise<PaymentAuthorization[]> {
    const rows = await runQueriesWithTenant<PaymentAuthorizationRow>(
      tenantId,
      `
      SELECT *
      FROM event_payment_authorization
      WHERE event_id = $1 AND tenant_id = $2
      ORDER BY authorized_at DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(r => this.toAuthorization(r));
  }

  /**
   * Converte PaymentAuthorizationRow para PaymentAuthorization
   */
  private toAuthorization(row: PaymentAuthorizationRow): PaymentAuthorization {
    return {
      id: row.id,
      event_id: row.event_id,
      custody_id: row.custody_id,
      split_id: row.split_id,
      tenant_id: row.tenant_id,
      status: row.status as PaymentAuthorizationStatus,
      user_authorization: row.user_authorization,
      authorization_reason: row.authorization_reason || undefined,
      authorizedAt: row.authorized_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      revokedAt: row.revoked_at ? row.revoked_at.toISOString() : undefined,
      executedAt: row.executed_at ? row.executed_at.toISOString() : undefined,
      cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : undefined,
    };
  }
}

export const eventPaymentPreparedService = new EventPaymentPreparedService();


