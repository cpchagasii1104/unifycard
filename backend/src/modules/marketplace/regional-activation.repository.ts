// backend/src/modules/marketplace/regional-activation.repository.ts
// FASE X — Bloco 2: Regional Activation Rules (persistência)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type ActionType = 'suggest_hub' | 'enable_industry_onboarding' | 'unlock_incentive';

export interface RegionalActivationRuleRow {
  id: string;
  tenant_id: string;
  country: string;
  state: string;
  city: string;
  action_type: string;
  threshold_volume_cents: string | null;
  threshold_transactions: number | null;
  is_active: boolean;
  created_at: Date;
}

export interface UpsertRuleInput {
  country: string;
  state: string;
  city: string;
  actionType: ActionType;
  thresholdVolumeCents?: number | null;
  thresholdTransactions?: number | null;
  isActive?: boolean;
}

class RegionalActivationRepository {
  async getRulesByRegion(
    tenantId: string,
    region: { country: string; state: string; city: string }
  ): Promise<RegionalActivationRuleRow[]> {
    const rows = await runQueriesWithTenant<RegionalActivationRuleRow>(
      tenantId,
      `
      SELECT id, tenant_id, country, state, city, action_type, threshold_volume_cents, threshold_transactions, is_active, created_at
      FROM regional_activation_rules
      WHERE tenant_id = $1 AND country = $2 AND state = $3 AND city = $4 AND is_active = true
      `,
      [tenantId, region.country, region.state, region.city]
    );
    return rows;
  }

  async getRuleByAction(
    tenantId: string,
    region: { country: string; state: string; city: string },
    actionType: ActionType
  ): Promise<RegionalActivationRuleRow | null> {
    const rows = await runQueriesWithTenant<RegionalActivationRuleRow>(
      tenantId,
      `
      SELECT id, tenant_id, country, state, city, action_type, threshold_volume_cents, threshold_transactions, is_active, created_at
      FROM regional_activation_rules
      WHERE tenant_id = $1 AND country = $2 AND state = $3 AND city = $4 AND action_type = $5 AND is_active = true
      `,
      [tenantId, region.country, region.state, region.city, actionType]
    );
    return rows[0] ?? null;
  }

  async upsertRule(tenantId: string, input: UpsertRuleInput): Promise<RegionalActivationRuleRow> {
    const row = await runQueryWithTenant<RegionalActivationRuleRow>(
      tenantId,
      `
      INSERT INTO regional_activation_rules (tenant_id, country, state, city, action_type, threshold_volume_cents, threshold_transactions, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, country, state, city, action_type) DO UPDATE SET
        threshold_volume_cents = EXCLUDED.threshold_volume_cents,
        threshold_transactions = EXCLUDED.threshold_transactions,
        is_active = EXCLUDED.is_active
      RETURNING id, tenant_id, country, state, city, action_type, threshold_volume_cents, threshold_transactions, is_active, created_at
      `,
      [
        tenantId,
        input.country,
        input.state,
        input.city,
        input.actionType,
        input.thresholdVolumeCents ?? null,
        input.thresholdTransactions ?? null,
        input.isActive ?? true,
      ]
    );
    if (!row) {
      throw new Error('Regional activation rule not upserted');
    }
    return row;
  }
}

export const regionalActivationRepository = new RegionalActivationRepository();