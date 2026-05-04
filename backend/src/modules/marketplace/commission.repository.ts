// backend/src/modules/marketplace/commission.repository.ts
// SPRINT 74: Repository para commission_rules

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { CommissionRule } from './commission.types';

interface CommissionRuleRow {
  id: string;
  tenant_id: string;
  applies_to: string;
  applies_id: string;
  base_percentage: number;
  regional_percentage: number;
  platform_percentage: number;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
}

class CommissionRepository {
  private toCommissionRule(row: CommissionRuleRow): CommissionRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      appliesTo: row.applies_to as any,
      appliesId: row.applies_id,
      basePercentage: parseFloat(row.base_percentage.toString()),
      regionalPercentage: parseFloat(row.regional_percentage.toString()),
      platformPercentage: parseFloat(row.platform_percentage.toString()),
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  async createRule(
    tenantId: string,
    input: {
      appliesTo: string;
      appliesId: string;
      basePercentage: number;
      regionalPercentage: number;
      platformPercentage: number;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<CommissionRule> {
    const row = await runQueryWithTenant<CommissionRuleRow>(
      tenantId,
      `
      INSERT INTO commission_rules (tenant_id, applies_to, applies_id, base_percentage, regional_percentage, platform_percentage, created_by_actor_id, created_by_user_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING id, tenant_id, applies_to, applies_id, base_percentage, regional_percentage, platform_percentage, created_by_actor_id, created_by_user_id, metadata, created_at
      `,
      [
        tenantId,
        input.appliesTo,
        input.appliesId,
        input.basePercentage,
        input.regionalPercentage,
        input.platformPercentage,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar regra de comissão');
    }

    return this.toCommissionRule(row);
  }

  async findRuleByApplies(
    tenantId: string,
    appliesTo: string,
    appliesId: string
  ): Promise<CommissionRule | null> {
    const rows = await runQueriesWithTenant<CommissionRuleRow>(
      tenantId,
      `
      SELECT id, tenant_id, applies_to, applies_id, base_percentage, regional_percentage, platform_percentage, created_by_actor_id, created_by_user_id, metadata, created_at
      FROM commission_rules
      WHERE tenant_id = $1 AND applies_to = $2 AND applies_id = $3
      LIMIT 1
      `,
      [tenantId, appliesTo, appliesId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toCommissionRule(rows[0]);
  }
}

export const commissionRepository = new CommissionRepository();








