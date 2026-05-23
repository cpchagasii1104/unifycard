// backend/src/modules/bank/bank-limit.repository.ts
// SPRINT 36.1: BANK SAFETY LAYER - Repository para pedidos de mudança de limite

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { asMoneyCents, type MoneyCents } from '@contracts/marketplace/canonical';
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
  requested_at: Date;
  effective_at: Date;
  status: string;
  requested_by_user_id: string | null;
  authority_source: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
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
      requestedAmountCents: asMoneyCents(parseInt(String(row.requested_amount), 10)),
      requestedAt: row.requested_at,
      effectiveAt: row.effective_at,
      status: row.status as LimitChangeRequestStatus,
      requestedByUserId: row.requested_by_user_id,
      authoritySource: row.authority_source as 'self' | 'delegated' | 'system',
      metadata: row.metadata,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
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
        requested_at, effective_at, status,
        requested_by_user_id, authority_source, metadata
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)
      RETURNING id, tenant_id, actor_id, limit_type, requested_amount,
                requested_at, effective_at, status,
                requested_by_user_id, authority_source, metadata,
                created_at, updated_at
      `,
      [
        tenantId,
        input.actorId,
        input.limitType,
        input.amountCents,
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
  ): Promise<MoneyCents | null> {
    const row = await runQueryWithTenant<{ requested_amount: string }>(
      tenantId,
      `
      SELECT requested_amount
      FROM bank_limit_change_requests
      WHERE tenant_id = $1
        AND actor_id = $2
        AND limit_type = $3
        AND status = 'applied'
      ORDER BY effective_at DESC, created_at DESC
      LIMIT 1
      `,
      [tenantId, actorId, limitType]
    );

    return row ? asMoneyCents(parseInt(String(row.requested_amount), 10)) : null;
  }

  /**
   * Busca pedidos pendentes que devem ser aplicados (effective_at <= now)
   */
  async getPendingRequestsDue(
    tenantId: string,
    actorId?: string
  ): Promise<BankLimitChangeRequest[]> {
    const conditions = ['tenant_id = $1', "status = 'pending'", 'effective_at <= NOW()'];
    const params: any[] = [tenantId];

    if (actorId) {
      conditions.push('actor_id = $2');
      params.push(actorId);
    }

    const rows = await runQueriesWithTenant<BankLimitChangeRequestRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, limit_type, requested_amount,
             requested_at, effective_at, status,
             requested_by_user_id, authority_source, metadata,
             created_at, updated_at
      FROM bank_limit_change_requests
      WHERE ${conditions.join(' AND ')}
      ORDER BY effective_at ASC, created_at ASC
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
      SET status = $1, updated_at = NOW()
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
             requested_at, effective_at, status,
             requested_by_user_id, authority_source, metadata,
             created_at, updated_at
      FROM bank_limit_change_requests
      WHERE tenant_id = $1 AND actor_id = $2
      ORDER BY created_at DESC
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
             requested_at, effective_at, status,
             requested_by_user_id, authority_source, metadata,
             created_at, updated_at
      FROM bank_limit_change_requests
      WHERE tenant_id = $1
        AND actor_id = $2
        AND limit_type = $3
        AND status = 'pending'
      ORDER BY effective_at ASC
      LIMIT 1
      `,
      [tenantId, actorId, limitType]
    );

    return row ? this.toLimitChangeRequest(row) : null;
  }
}

export const bankLimitRepository = new BankLimitRepository();
