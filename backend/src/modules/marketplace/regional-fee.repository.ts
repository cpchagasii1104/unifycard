// backend/src/modules/marketplace/regional-fee.repository.ts
// SPRINT 83: TAXA REGIONAL + ECONOMIA COMUNITÁRIA

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  RegionalFee,
  CreateRegionalFeeInput,
  RegionalFeeFilters,
} from './regional-fee.types';

interface RegionalFeeRow {
  id: string;
  tenant_id: string;
  region_id: string;
  source_type: string;
  source_id: string;
  gross_amount: number;
  fee_percentage: number;
  fee_amount: number;
  settlement_id: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

class RegionalFeeRepository {
  private toRegionalFee(row: RegionalFeeRow): RegionalFee {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      regionId: row.region_id,
      sourceType: row.source_type as any,
      sourceId: row.source_id,
      grossAmount: Number(row.gross_amount),
      feeBps: Math.round(Number(row.fee_percentage) * 100),
      feeAmount: Number(row.fee_amount),
      settlementId: row.settlement_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  async createFee(
    tenantId: string,
    input: CreateRegionalFeeInput
  ): Promise<RegionalFee> {
    const row = await runQueryWithTenant<RegionalFeeRow>(
      tenantId,
      `
      INSERT INTO regional_fees (
        tenant_id, region_id, source_type, source_id,
        gross_amount, fee_percentage, fee_amount, settlement_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, tenant_id, region_id, source_type, source_id,
                gross_amount, fee_percentage, fee_amount, settlement_id,
                metadata, created_at
      `,
      [
        tenantId,
        input.regionId,
        input.sourceType,
        input.sourceId,
        input.grossAmount,
        input.feeBps / 100,
        input.feeAmount,
        input.settlementId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('RegionalFee not created');
    }
    return this.toRegionalFee(row);
  }

  async getFeeById(tenantId: string, feeId: string): Promise<RegionalFee | null> {
    const rows = await runQueriesWithTenant<RegionalFeeRow>(
      tenantId,
      `
      SELECT id, tenant_id, region_id, source_type, source_id,
             gross_amount, fee_percentage, fee_amount, settlement_id,
             metadata, created_at
      FROM regional_fees
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, feeId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (!row) return null;
    return this.toRegionalFee(row);
  }

  async listFees(
    tenantId: string,
    filters: RegionalFeeFilters = {}
  ): Promise<RegionalFee[]> {
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

    if (filters.sourceId) {
      conditions.push(`source_id = $${paramIndex}`);
      params.push(filters.sourceId);
      paramIndex++;
    }

    if (filters.settlementId !== undefined) {
      if (filters.settlementId === null) {
        conditions.push(`settlement_id IS NULL`);
      } else {
        conditions.push(`settlement_id = $${paramIndex}`);
        params.push(filters.settlementId);
        paramIndex++;
      }
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<RegionalFeeRow>(
      tenantId,
      `
      SELECT id, tenant_id, region_id, source_type, source_id,
             gross_amount, fee_percentage, fee_amount, settlement_id,
             metadata, created_at
      FROM regional_fees
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toRegionalFee(row));
  }

  async getFeesByRegion(
    tenantId: string,
    regionId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RegionalFee[]> {
    const conditions: string[] = ['tenant_id = $1', 'region_id = $2'];
    const params: any[] = [tenantId, regionId];
    let paramIndex = 3;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const rows = await runQueriesWithTenant<RegionalFeeRow>(
      tenantId,
      `
      SELECT id, tenant_id, region_id, source_type, source_id,
             gross_amount, fee_percentage, fee_amount, settlement_id,
             metadata, created_at
      FROM regional_fees
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      `,
      params
    );

    return rows.map((row) => this.toRegionalFee(row));
  }

  async updateSettlementId(
    tenantId: string,
    feeId: string,
    settlementId: string
  ): Promise<RegionalFee> {
    const row = await runQueryWithTenant<RegionalFeeRow>(
      tenantId,
      `
      UPDATE regional_fees
      SET settlement_id = $3
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, region_id, source_type, source_id,
                gross_amount, fee_percentage, fee_amount, settlement_id,
                metadata, created_at
      `,
      [tenantId, feeId, settlementId]
    );

    if (!row) {
      throw new Error('RegionalFee not found after updateSettlementId');
    }
    return this.toRegionalFee(row);
  }
}

export const regionalFeeRepository = new RegionalFeeRepository();



