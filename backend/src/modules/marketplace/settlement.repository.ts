// backend/src/modules/marketplace/settlement.repository.ts
// SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { Settlement, SettlementFilters } from './settlement.types';

interface SettlementRow {
  id: string;
  tenant_id: string;
  region_id: string;
  source_type: string;
  source_id: string;
  gross_amount_cents: number;
  fee_amount_cents: number;
  net_amount_cents: number;
  currency: string;
  status: string;
  settled_at: Date | null;
  settled_by_actor_id: string | null;
  settled_by_user_id: string | null;
  failed_at: Date | null;
  failure_reason: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class SettlementRepository {
  private toSettlement(row: SettlementRow): Settlement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      regionId: row.region_id,
      sourceType: row.source_type as any,
      sourceId: row.source_id,
      grossAmountCents: row.gross_amount_cents,
      feeAmountCents: row.fee_amount_cents,
      netAmountCents: row.net_amount_cents,
      currency: row.currency,
      status: row.status as any,
      settledAt: row.settled_at,
      settledByActorId: row.settled_by_actor_id,
      settledByUserId: row.settled_by_user_id,
      failedAt: row.failed_at,
      failureReason: row.failure_reason,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createSettlement(
    tenantId: string,
    input: {
      regionId: string;
      sourceType: string;
      sourceId: string;
      grossAmountCents: number;
      feeAmountCents: number;
      netAmountCents: number;
      currency: string;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<Settlement> {
    const row = await runQueryWithTenant<SettlementRow>(
      tenantId,
      `
      INSERT INTO settlements (
        tenant_id, region_id, source_type, source_id,
        gross_amount_cents, fee_amount_cents, net_amount_cents, currency,
        status, created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      RETURNING id, tenant_id, region_id, source_type, source_id,
                gross_amount_cents, fee_amount_cents, net_amount_cents, currency,
                status, settled_at, settled_by_actor_id, settled_by_user_id,
                failed_at, failure_reason,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [
        tenantId,
        input.regionId,
        input.sourceType,
        input.sourceId,
        input.grossAmountCents,
        input.feeAmountCents,
        input.netAmountCents,
        input.currency,
        'PENDING',
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar settlement');
    }

    return this.toSettlement(row);
  }

  async getSettlementById(tenantId: string, settlementId: string): Promise<Settlement | null> {
    const rows = await runQueriesWithTenant<SettlementRow>(
      tenantId,
      `
      SELECT id, tenant_id, region_id, source_type, source_id,
             gross_amount_cents, fee_amount_cents, net_amount_cents, currency,
             status, settled_at, settled_by_actor_id, settled_by_user_id,
             failed_at, failure_reason,
             created_by_actor_id, created_by_user_id, metadata,
             created_at, updated_at
      FROM settlements
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, settlementId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toSettlement(rows[0]);
  }

  async listSettlements(tenantId: string, filters: SettlementFilters = {}): Promise<Settlement[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.regionId) {
      conditions.push(`region_id = $${paramIndex}`);
      params.push(filters.regionId);
      paramIndex++;
    }

    if (filters.sourceType) {
      conditions.push(`source_type = $${paramIndex}`);
      params.push(filters.sourceType);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<SettlementRow>(
      tenantId,
      `
      SELECT id, tenant_id, region_id, source_type, source_id,
             gross_amount_cents, fee_amount_cents, net_amount_cents, currency,
             status, settled_at, settled_by_actor_id, settled_by_user_id,
             failed_at, failure_reason,
             created_by_actor_id, created_by_user_id, metadata,
             created_at, updated_at
      FROM settlements
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toSettlement(row));
  }

  async markAsSettled(
    tenantId: string,
    settlementId: string,
    settledByActorId: string,
    settledByUserId: string | null
  ): Promise<Settlement> {
    const row = await runQueryWithTenant<SettlementRow>(
      tenantId,
      `
      UPDATE settlements
      SET status = 'SETTLED',
          settled_at = NOW(),
          settled_by_actor_id = $3,
          settled_by_user_id = $4,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, region_id, source_type, source_id,
                gross_amount_cents, fee_amount_cents, net_amount_cents, currency,
                status, settled_at, settled_by_actor_id, settled_by_user_id,
                failed_at, failure_reason,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [tenantId, settlementId, settledByActorId, settledByUserId]
    );

    if (!row) {
      throw new Error('Settlement não encontrado ou não está em PENDING');
    }

    return this.toSettlement(row);
  }

  async markAsFailed(
    tenantId: string,
    settlementId: string,
    failureReason: string
  ): Promise<Settlement> {
    const row = await runQueryWithTenant<SettlementRow>(
      tenantId,
      `
      UPDATE settlements
      SET status = 'FAILED',
          failed_at = NOW(),
          failure_reason = $3,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
      RETURNING id, tenant_id, region_id, source_type, source_id,
                gross_amount_cents, fee_amount_cents, net_amount_cents, currency,
                status, settled_at, settled_by_actor_id, settled_by_user_id,
                failed_at, failure_reason,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [tenantId, settlementId, failureReason]
    );

    if (!row) {
      throw new Error('Settlement não encontrado ou não está em PENDING');
    }

    return this.toSettlement(row);
  }
}

export const settlementRepository = new SettlementRepository();





