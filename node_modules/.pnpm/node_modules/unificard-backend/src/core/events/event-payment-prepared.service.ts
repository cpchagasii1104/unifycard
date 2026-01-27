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

import { eventService } from './event.service';
import { eventEconomicPhaseService } from './event-economic-phase.service';
import { eventCustodyService } from './event-custody.service';
import { eventSplitDeclarativeService } from './event-split-declarative.service';
import { eventBus } from './event-bus';
import { BadRequestError, NotFoundError } from '@core/errors';
import { runQueryWithTenant } from '@core/database/pool';
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
  authorized_at: string;
  updated_at: string;
  revoked_at?: string;
  executed_at?: string;
  cancelled_at?: string;
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
  authorized_at: string;
  updated_at: string;
  revoked_at: string | null;
  executed_at: string | null;
  cancelled_at: string | null;
}

class EventPaymentPreparedService {
  /**
   * Autoriza pagamento explicitamente
   * 
   * Emite: event.payment.authorized
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

    // 6. Criar autorização de pagamento
    const authorizationId = uuidv4();
    const row = await runQueryWithTenant<PaymentAuthorizationRow>(
      tenantId,
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

    if (!row || row.length === 0) {
      throw new Error('Falha ao autorizar pagamento');
    }

    const authorization = this.toAuthorization(row[0]);

    // 7. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.payment.authorized',
      payload: {
        authorization_id: authorization.id,
        event_id: input.event_id,
        custody_id: input.custody_id,
        split_id: input.split_id,
        actor_id: actorId,
        user_authorization: input.user_authorization,
        authorization_reason: input.authorization_reason,
        authorized_at: authorization.authorized_at,
      },
    });

    return authorization;
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

    if (!row || row.length === 0) {
      throw new Error('Falha ao revogar autorização');
    }

    return this.toAuthorization(row[0]);
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

    if (!row || row.length === 0) {
      return null;
    }

    return this.toAuthorization(row[0]);
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

    if (!row || row.length === 0) {
      return null;
    }

    return this.toAuthorization(row[0]);
  }

  /**
   * Lista autorizações de um evento
   */
  async listAuthorizationsByEvent(
    tenantId: string,
    eventId: string
  ): Promise<PaymentAuthorization[]> {
    const rows = await runQueryWithTenant<PaymentAuthorizationRow>(
      tenantId,
      `
      SELECT *
      FROM event_payment_authorization
      WHERE event_id = $1 AND tenant_id = $2
      ORDER BY authorized_at DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(row => this.toAuthorization(row[0]));
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
      authorized_at: row.authorized_at,
      updated_at: row.updated_at,
      revoked_at: row.revoked_at || undefined,
      executed_at: row.executed_at || undefined,
      cancelled_at: row.cancelled_at || undefined,
    };
  }
}

export const eventPaymentPreparedService = new EventPaymentPreparedService();

