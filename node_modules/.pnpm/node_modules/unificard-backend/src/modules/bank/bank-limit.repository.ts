// backend/src/modules/bank/bank-limit.repository.ts
// SPRINT 36.1: BANK SAFETY LAYER - Repository para pedidos de mudança de limite

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  BankLimitChangeRequest,
  RequestLimitChangeInput,
  BankLimitType,
  LimitChangeRequestStatus,
} from './bank-limit.types';

interface BankLimitChangeRequestRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  limit_type: string;
  requested_amount: string;
  requestedAt: Date;
  effectiveAt: Date;
  status: string;
  requested_by_user_id: string | null;
  authority_source: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class BankLimitRepository {
  /**
   * Converte row do banco para objeto BankLimitChangeRequest
   */
  private toLimitChangeRequest(row: BankLimitChangeRequestRow): BankLimitChangeRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      limitType: row.limit_type as BankLimitType,
      requestedAmount: parseFloat(row.requested_amount),
      requestedAt: row.requestedAt,
      effectiveAt: row.effectiveAt,
      status: row.status as LimitChangeRequestStatus,
      requestedByUserId: row.requested_by_user_id,
      authoritySource: row.authority_source as 'self' | 'delegated' | 'system',
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria novo pedido de mudança de limite (append-only)
   */
  async createLimitChangeRequest(
    tenantId: string,
    input: RequestLimitChangeInput,
    effectiveAt: Date,
    status: LimitChangeRequestStatus
  ): Promise<BankLimitChangeRequest> {
    const row = await runQueryWithTenant<BankLimitChangeRequestRow>(
      tenantId,
      `
      INSERT INTO bank_limit_change_requests (
        tenant_id, actor_id, limit_type, requested_amount,
        requestedAt, effectiveAt, status,
        requested_by_user_id, authority_source, metadata
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
      RETURNING id, tenant_id, actor_id, limit_type, requested_amount,
                requestedAt, effectiveAt, status,
                requested_by_user_id, authority_source, metadata,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.actorId,
        input.limitType,
        input.amount,
        effectiveAt,
        status,
        input.requestedByUserId || null,
        input.authoritySource || 'self',
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar pedido de mudança de limite');
    }

    return this.toLimitChangeRequest(row);
  }

  /**
   * Busca último limite aplicado por tipo
   */
  async getLastAppliedLimit(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType
  ): Promise<number | null> {
    const row = await runQueryWithTenant<{ requested_amount: string }>(
      tenantId,
      `
      SELECT requested_amount
      FROM bank_limit_change_requests
      WHERE tenant_id = $1
        AND actor_id = $2
        AND limit_type = $3
        AND status = 'applied'
      ORDER BY effectiveAt DESC, createdAt DESC
      LIMIT 1
      `,
      [tenantId, actorId, limitType]
    );

    return row ? parseFloat(row.requested_amount) : null;
  }

  /**
   * Busca pedidos pendentes que devem ser aplicados (effectiveAt <= now)
   */
  async getPendingRequestsDue(
    tenantId: string,
    actorId?: string
  ): Promise<BankLimitChangeRequest[]> {
    const conditions = ['tenant_id = $1', "status = 'pending'", 'effectiveAt <= NOW()'];
    const params: any[] = [tenantId];

    if (actorId) {
      conditions.push('actor_id = $2');
      params.push(actorId);
    }

    const rows = await runQueriesWithTenant<BankLimitChangeRequestRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, limit_type, requested_amount,
             requestedAt, effectiveAt, status,
             requested_by_user_id, authority_source, metadata,
             createdAt, updatedAt
      FROM bank_limit_change_requests
      WHERE ${conditions.join(' AND ')}
      ORDER BY effectiveAt ASC, createdAt ASC
      `,
      params
    );

    return rows.map((row) => this.toLimitChangeRequest(row));
  }

  /**
   * Atualiza status de um pedido (append-only: apenas status muda)
   */
  async updateRequestStatus(
    tenantId: string,
    requestId: string,
    status: LimitChangeRequestStatus
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE bank_limit_change_requests
      SET status = $1, updatedAt = NOW()
      WHERE id = $2 AND tenant_id = $3
      `,
      [status, requestId, tenantId]
    );
  }

  /**
   * Busca todos os limites de um actor (histórico completo)
   */
  async getActorLimits(
    tenantId: string,
    actorId: string
  ): Promise<BankLimitChangeRequest[]> {
    const rows = await runQueriesWithTenant<BankLimitChangeRequestRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, limit_type, requested_amount,
             requestedAt, effectiveAt, status,
             requested_by_user_id, authority_source, metadata,
             createdAt, updatedAt
      FROM bank_limit_change_requests
      WHERE tenant_id = $1 AND actor_id = $2
      ORDER BY createdAt DESC
      `,
      [tenantId, actorId]
    );

    return rows.map((row) => this.toLimitChangeRequest(row));
  }

  /**
   * Busca pedidos pendentes por actor e tipo
   */
  async getPendingRequest(
    tenantId: string,
    actorId: string,
    limitType: BankLimitType
  ): Promise<BankLimitChangeRequest | null> {
    const row = await runQueryWithTenant<BankLimitChangeRequestRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, limit_type, requested_amount,
             requestedAt, effectiveAt, status,
             requested_by_user_id, authority_source, metadata,
             createdAt, updatedAt
      FROM bank_limit_change_requests
      WHERE tenant_id = $1
        AND actor_id = $2
        AND limit_type = $3
        AND status = 'pending'
      ORDER BY effectiveAt ASC
      LIMIT 1
      `,
      [tenantId, actorId, limitType]
    );

    return row ? this.toLimitChangeRequest(row) : null;
  }
}

export const bankLimitRepository = new BankLimitRepository();









