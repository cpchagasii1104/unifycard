// backend/src/modules/marketplace/regional-activation-events.repository.ts
// FASE X — Bloco 2: Regional Activation Events (histórico persistido)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type ActionType = 'suggest_hub' | 'enable_industry_onboarding' | 'unlock_incentive';

export interface RegionalActivationEventRow {
  id: string;
  tenant_id: string;
  country: string;
  state: string;
  city: string;
  action_type: string;
  snapshot_id: string | null;
  triggered_at: Date;
  metadata: Record<string, unknown> | null;
}

export interface RecordActivationInput {
  country: string;
  state: string;
  city: string;
  actionType: ActionType;
  snapshotId?: string | null;
  metadata?: Record<string, unknown> | null;
}

class RegionalActivationEventsRepository {
  async recordActivation(tenantId: string, input: RecordActivationInput): Promise<RegionalActivationEventRow> {
    const row = await runQueryWithTenant<RegionalActivationEventRow>(
      tenantId,
      `
      INSERT INTO regional_activation_events (tenant_id, country, state, city, action_type, snapshot_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, country, state, city, action_type, snapshot_id, triggered_at, metadata
      `,
      [
        tenantId,
        input.country,
        input.state,
        input.city,
        input.actionType,
        input.snapshotId ?? null,
        input.metadata ?? null,
      ]
    );
    if (!row) {
      throw new Error('Regional activation event not recorded');
    }
    return row;
  }

  async listByRegion(
    tenantId: string,
    region: { country: string; state: string; city: string }
  ): Promise<RegionalActivationEventRow[]> {
    const rows = await runQueriesWithTenant<RegionalActivationEventRow>(
      tenantId,
      `
      SELECT id, tenant_id, country, state, city, action_type, snapshot_id, triggered_at, metadata
      FROM regional_activation_events
      WHERE tenant_id = $1 AND country = $2 AND state = $3 AND city = $4
      ORDER BY triggered_at DESC
      `,
      [tenantId, region.country, region.state, region.city]
    );
    return rows;
  }
}

export const regionalActivationEventsRepository = new RegionalActivationEventsRepository();