// backend/src/core/events/event-refund-chargeback.service.ts
// Event Refund/Chargeback Service (FASE 6.0)
// FASE_6_FLUXO_ESTORNO_CHARGEBACK.md

/**
 * 🔴 ESTORNO E CHARGEBACK SÃO CORE
 * 
 * Toda execução econômica DEVE ser reversível.
 * 
 * Se não pode ser estornado:
 * → não pode ser executado.
 * 
 * TIPOS DE REVERSÃO:
 * - Estorno antes da execução
 * - Estorno após execução
 * - Estorno parcial
 * - Chargeback externo (ex: adquirente)
 * - Cancelamento institucional
 * 
 * EVENTOS CANÔNICOS:
 * - event.refund.requested
 * - event.refund.approved
 * - event.refund.executed
 * - event.chargeback.initiated
 * - event.chargeback.resolved
 * - event.custody.reverted
 * 
 * PROIBIDO:
 * - correção manual
 * - ajuste silencioso
 * - apagar histórico econômico
 */

import { eventService } from './event.service';
import { eventCustodyService } from './event-custody.service';
import { eventPaymentPreparedService } from './event-payment-prepared.service';
import { eventBus } from './event-bus';
import { BadRequestError, NotFoundError } from '@core/errors';
import { runQueryWithTenant } from '@core/database/pool';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tipo de estorno
 */
export type RefundType = 'full' | 'partial' | 'chargeback' | 'cancellation';

/**
 * Status do estorno
 */
export type RefundStatus = 'requested' | 'approved' | 'executed' | 'rejected' | 'cancelled';

/**
 * Status do chargeback
 */
export type ChargebackStatus = 'initiated' | 'resolved' | 'rejected' | 'cancelled';

/**
 * Input para solicitar estorno
 */
export interface RequestRefundInput {
  event_id: string;
  custody_id: string;
  refund_type: RefundType;
  amount_cents?: number; // Obrigatório se partial
  reason: string;
  requested_by_actor_id: string;
}

/**
 * Input para aprovar estorno
 */
export interface ApproveRefundInput {
  refund_id: string;
  approved_by_actor_id: string;
  approval_reason?: string;
}

/**
 * Input para executar estorno
 */
export interface ExecuteRefundInput {
  refund_id: string;
  executed_by_actor_id: string;
  execution_reason?: string;
}

/**
 * Input para iniciar chargeback
 */
export interface InitiateChargebackInput {
  event_id: string;
  custody_id: string;
  amount_cents: number;
  external_reference?: string; // Referência do adquirente
  reason: string;
  initiated_by_actor_id: string;
}

/**
 * Estorno
 */
export interface Refund {
  id: string;
  event_id: string;
  custody_id: string;
  tenant_id: string;
  refund_type: RefundType;
  amount_cents: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  requested_by_actor_id: string;
  approved_by_actor_id?: string;
  executed_by_actor_id?: string;
  requested_at: string;
  approved_at?: string;
  executed_at?: string;
  rejected_at?: string;
  cancelled_at?: string;
}

/**
 * Chargeback
 */
export interface Chargeback {
  id: string;
  event_id: string;
  custody_id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  status: ChargebackStatus;
  external_reference?: string;
  reason: string;
  initiated_by_actor_id: string;
  resolved_by_actor_id?: string;
  initiated_at: string;
  resolved_at?: string;
  frozen_executions: boolean; // Congela novas execuções
}

interface RefundRow {
  id: string;
  tenant_id: string;
  event_id: string;
  custody_id: string;
  refund_type: string;
  amount_cents: number;
  currency: string;
  status: string;
  reason: string;
  requested_by_actor_id: string;
  approved_by_actor_id: string | null;
  executed_by_actor_id: string | null;
  requested_at: string;
  approved_at: string | null;
  executed_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
}

interface ChargebackRow {
  id: string;
  tenant_id: string;
  event_id: string;
  custody_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  external_reference: string | null;
  reason: string;
  initiated_by_actor_id: string;
  resolved_by_actor_id: string | null;
  initiated_at: string;
  resolved_at: string | null;
  frozen_executions: boolean;
}

class EventRefundChargebackService {
  /**
   * Solicita estorno
   * 
   * Emite: event.refund.requested
   */
  async requestRefund(
    tenantId: string,
    input: RequestRefundInput
  ): Promise<Refund> {
    // 1. Verificar se custódia existe
    const custody = await eventCustodyService.getCustody(tenantId, input.custody_id);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }
    if (custody.event_id !== input.event_id) {
      throw new BadRequestError('Custódia não pertence ao evento');
    }

    // 2. Validar tipo de estorno
    if (input.refund_type === 'partial' && !input.amount_cents) {
      throw new BadRequestError('Estorno parcial requer amount_cents');
    }
    if (input.refund_type === 'full' && input.amount_cents) {
      throw new BadRequestError('Estorno total não deve ter amount_cents');
    }

    // 3. Validar valor (se parcial)
    if (input.refund_type === 'partial' && input.amount_cents) {
      if (input.amount_cents <= 0) {
        throw new BadRequestError('Valor do estorno parcial deve ser maior que zero');
      }
      if (input.amount_cents >= custody.amount_cents) {
        throw new BadRequestError('Valor do estorno parcial deve ser menor que o valor da custódia');
      }
    }

    // 4. Determinar valor do estorno
    const refundAmount = input.refund_type === 'full' 
      ? custody.amount_cents 
      : (input.amount_cents || 0);

    // 5. Criar solicitação de estorno
    const refundId = uuidv4();
    const row = await runQueryWithTenant<RefundRow>(
      tenantId,
      `
      INSERT INTO event_refund (
        id, tenant_id, event_id, custody_id,
        refund_type, amount_cents, currency, status,
        reason, requested_by_actor_id, requested_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
      `,
      [
        refundId,
        tenantId,
        input.event_id,
        input.custody_id,
        input.refund_type,
        refundAmount,
        custody.currency,
        'requested',
        input.reason,
        input.requested_by_actor_id,
      ]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao solicitar estorno');
    }

    const refund = this.toRefund(row[0]);

    // 6. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.refund.requested',
      payload: {
        refund_id: refund.id,
        event_id: input.event_id,
        custody_id: input.custody_id,
        refund_type: input.refund_type,
        amount_cents: refundAmount,
        currency: custody.currency,
        reason: input.reason,
        requested_by_actor_id: input.requested_by_actor_id,
      },
    });

    return refund;
  }

  /**
   * Aprova estorno
   * 
   * Emite: event.refund.approved
   */
  async approveRefund(
    tenantId: string,
    input: ApproveRefundInput
  ): Promise<Refund> {
    // 1. Buscar estorno
    const refund = await this.getRefund(tenantId, input.refund_id);
    if (!refund) {
      throw new NotFoundError('Estorno não encontrado');
    }

    // 2. Verificar se pode ser aprovado
    if (refund.status !== 'requested') {
      throw new BadRequestError(`Estorno não pode ser aprovado (status: ${refund.status})`);
    }

    // 3. Atualizar status
    const row = await runQueryWithTenant<RefundRow>(
      tenantId,
      `
      UPDATE event_refund
      SET status = 'approved', approved_by_actor_id = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [input.approved_by_actor_id, input.refund_id, tenantId]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao aprovar estorno');
    }

    const approvedRefund = this.toRefund(row[0]);

    // 4. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.refund.approved',
      payload: {
        refund_id: approvedRefund.id,
        event_id: approvedRefund.event_id,
        custody_id: approvedRefund.custody_id,
        amount_cents: approvedRefund.amount_cents,
        approval_reason: input.approval_reason,
        approved_by_actor_id: input.approved_by_actor_id,
      },
    });

    return approvedRefund;
  }

  /**
   * Executa estorno
   * 
   * Emite: event.refund.executed
   * Emite: event.custody.reverted (se custódia for revertida)
   */
  async executeRefund(
    tenantId: string,
    input: ExecuteRefundInput
  ): Promise<Refund> {
    // 1. Buscar estorno
    const refund = await this.getRefund(tenantId, input.refund_id);
    if (!refund) {
      throw new NotFoundError('Estorno não encontrado');
    }

    // 2. Verificar se pode ser executado
    if (refund.status !== 'approved') {
      throw new BadRequestError(`Estorno não pode ser executado (status: ${refund.status})`);
    }

    // 3. Reverter custódia (se ainda estiver ativa)
    const custody = await eventCustodyService.getCustody(tenantId, refund.custody_id);
    if (custody && custody.status === 'active') {
      await eventCustodyService.revertCustody(
        tenantId,
        refund.custody_id,
        `Estorno executado: ${refund.reason}`
      );
    }

    // 4. Atualizar status do estorno
    const row = await runQueryWithTenant<RefundRow>(
      tenantId,
      `
      UPDATE event_refund
      SET status = 'executed', executed_by_actor_id = $1, executed_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [input.executed_by_actor_id, input.refund_id, tenantId]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao executar estorno');
    }

    const executedRefund = this.toRefund(row[0]);

    // 5. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.refund.executed',
      payload: {
        refund_id: executedRefund.id,
        event_id: executedRefund.event_id,
        custody_id: executedRefund.custody_id,
        amount_cents: executedRefund.amount_cents,
        execution_reason: input.execution_reason,
        executed_by_actor_id: input.executed_by_actor_id,
      },
    });

    return executedRefund;
  }

  /**
   * Inicia chargeback
   * 
   * Emite: event.chargeback.initiated
   * 
   * Chargeback congela novas execuções
   */
  async initiateChargeback(
    tenantId: string,
    input: InitiateChargebackInput
  ): Promise<Chargeback> {
    // 1. Verificar se custódia existe
    const custody = await eventCustodyService.getCustody(tenantId, input.custody_id);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }
    if (custody.event_id !== input.event_id) {
      throw new BadRequestError('Custódia não pertence ao evento');
    }

    // 2. Validar valor
    if (input.amount_cents <= 0) {
      throw new BadRequestError('Valor do chargeback deve ser maior que zero');
    }
    if (input.amount_cents > custody.amount_cents) {
      throw new BadRequestError('Valor do chargeback não pode ser maior que o valor da custódia');
    }

    // 3. Criar chargeback
    const chargebackId = uuidv4();
    const row = await runQueryWithTenant<ChargebackRow>(
      tenantId,
      `
      INSERT INTO event_chargeback (
        id, tenant_id, event_id, custody_id,
        amount_cents, currency, status,
        external_reference, reason, initiated_by_actor_id,
        frozen_executions, initiated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
      `,
      [
        chargebackId,
        tenantId,
        input.event_id,
        input.custody_id,
        input.amount_cents,
        custody.currency,
        'initiated',
        input.external_reference || null,
        input.reason,
        input.initiated_by_actor_id,
        true, // Congela execuções
      ]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao iniciar chargeback');
    }

    const chargeback = this.toChargeback(row[0]);

    // 4. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.chargeback.initiated',
      payload: {
        chargeback_id: chargeback.id,
        event_id: input.event_id,
        custody_id: input.custody_id,
        amount_cents: input.amount_cents,
        currency: custody.currency,
        external_reference: input.external_reference,
        reason: input.reason,
        initiated_by_actor_id: input.initiated_by_actor_id,
        frozen_executions: true,
      },
    });

    return chargeback;
  }

  /**
   * Resolve chargeback
   * 
   * Emite: event.chargeback.resolved
   */
  async resolveChargeback(
    tenantId: string,
    chargebackId: string,
    resolvedByActorId: string,
    resolution: 'approved' | 'rejected',
    resolutionReason?: string
  ): Promise<Chargeback> {
    // 1. Buscar chargeback
    const chargeback = await this.getChargeback(tenantId, chargebackId);
    if (!chargeback) {
      throw new NotFoundError('Chargeback não encontrado');
    }

    // 2. Verificar se pode ser resolvido
    if (chargeback.status !== 'initiated') {
      throw new BadRequestError(`Chargeback não pode ser resolvido (status: ${chargeback.status})`);
    }

    // 3. Atualizar status
    const newStatus = resolution === 'approved' ? 'resolved' : 'rejected';
    const row = await runQueryWithTenant<ChargebackRow>(
      tenantId,
      `
      UPDATE event_chargeback
      SET status = $1, resolved_by_actor_id = $2, resolved_at = NOW(), updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
      `,
      [newStatus, resolvedByActorId, chargebackId, tenantId]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao resolver chargeback');
    }

    const resolvedChargeback = this.toChargeback(row[0]);

    // 4. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.chargeback.resolved',
      payload: {
        chargeback_id: resolvedChargeback.id,
        event_id: resolvedChargeback.event_id,
        custody_id: resolvedChargeback.custody_id,
        resolution,
        resolution_reason: resolutionReason,
        resolved_by_actor_id: resolvedByActorId,
      },
    });

    return resolvedChargeback;
  }

  /**
   * Verifica se há chargeback ativo que congela execuções
   */
  async hasFrozenExecutions(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM event_chargeback
      WHERE event_id = $1 AND tenant_id = $2
        AND status = 'initiated'
        AND frozen_executions = true
      LIMIT 1
      `,
      [eventId, tenantId]
    );

    return result && result.length > 0 && parseInt(result[0].count, 10) > 0;
  }

  /**
   * Busca estorno por ID
   */
  async getRefund(
    tenantId: string,
    refundId: string
  ): Promise<Refund | null> {
    const row = await runQueryWithTenant<RefundRow>(
      tenantId,
      `
      SELECT *
      FROM event_refund
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [refundId, tenantId]
    );

    if (!row || row.length === 0) {
      return null;
    }

    return this.toRefund(row[0]);
  }

  /**
   * Busca chargeback por ID
   */
  async getChargeback(
    tenantId: string,
    chargebackId: string
  ): Promise<Chargeback | null> {
    const row = await runQueryWithTenant<ChargebackRow>(
      tenantId,
      `
      SELECT *
      FROM event_chargeback
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [chargebackId, tenantId]
    );

    if (!row || row.length === 0) {
      return null;
    }

    return this.toChargeback(row[0]);
  }

  /**
   * Lista estornos de um evento
   */
  async listRefundsByEvent(
    tenantId: string,
    eventId: string
  ): Promise<Refund[]> {
    const rows = await runQueryWithTenant<RefundRow>(
      tenantId,
      `
      SELECT *
      FROM event_refund
      WHERE event_id = $1 AND tenant_id = $2
      ORDER BY requested_at DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(row => this.toRefund(row));
  }

  /**
   * Lista chargebacks de um evento
   */
  async listChargebacksByEvent(
    tenantId: string,
    eventId: string
  ): Promise<Chargeback[]> {
    const rows = await runQueryWithTenant<ChargebackRow>(
      tenantId,
      `
      SELECT *
      FROM event_chargeback
      WHERE event_id = $1 AND tenant_id = $2
      ORDER BY initiated_at DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(row => this.toChargeback(row));
  }

  /**
   * Converte RefundRow para Refund
   */
  private toRefund(row: RefundRow): Refund {
    return {
      id: row.id,
      event_id: row.event_id,
      custody_id: row.custody_id,
      tenant_id: row.tenant_id,
      refund_type: row.refund_type as RefundType,
      amount_cents: row.amount_cents,
      currency: row.currency,
      status: row.status as RefundStatus,
      reason: row.reason,
      requested_by_actor_id: row.requested_by_actor_id,
      approved_by_actor_id: row.approved_by_actor_id || undefined,
      executed_by_actor_id: row.executed_by_actor_id || undefined,
      requested_at: row.requested_at,
      approved_at: row.approved_at || undefined,
      executed_at: row.executed_at || undefined,
      rejected_at: row.rejected_at || undefined,
      cancelled_at: row.cancelled_at || undefined,
    };
  }

  /**
   * Converte ChargebackRow para Chargeback
   */
  private toChargeback(row: ChargebackRow): Chargeback {
    return {
      id: row.id,
      event_id: row.event_id,
      custody_id: row.custody_id,
      tenant_id: row.tenant_id,
      amount_cents: row.amount_cents,
      currency: row.currency,
      status: row.status as ChargebackStatus,
      external_reference: row.external_reference || undefined,
      reason: row.reason,
      initiated_by_actor_id: row.initiated_by_actor_id,
      resolved_by_actor_id: row.resolved_by_actor_id || undefined,
      initiated_at: row.initiated_at,
      resolved_at: row.resolved_at || undefined,
      frozen_executions: row.frozen_executions,
    };
  }
}

export const eventRefundChargebackService = new EventRefundChargebackService();

