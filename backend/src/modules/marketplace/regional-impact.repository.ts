// backend/src/modules/marketplace/regional-impact.repository.ts
// FASE X — Bloco 2: Regional Impact Snapshots (persistência)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface RegionalImpactSnapshotRow {
  id: string;
  tenant_id: string;
  country: string;
  state: string;
  city: string;
  period: string;
  total_volume_cents: string;
  total_transactions: number;
  regional_fund_inflow_cents: string;
  regional_fund_outflow_cents: string;
  created_at: Date;
}

export interface UpsertSnapshotInput {
  country: string;
  state: string;
  city: string;
  period: string;
  totalVolumeCents: number;
  totalTransactions: number;
  regionalFundInflowCents: number;
  regionalFundOutflowCents: number;
}

class RegionalImpactRepository {
  async getLatestSnapshot(
    tenantId: string,
    region: { country: string; state: string; city: string }
  ): Promise<RegionalImpactSnapshotRow | null> {
    const rows = await runQueriesWithTenant<RegionalImpactSnapshotRow>(
      tenantId,
      `
      SELECT id, tenant_id, country, state, city, period, total_volume_cents, total_transactions,
             regional_fund_inflow_cents, regional_fund_outflow_cents, created_at
      FROM regional_impact_snapshots
      WHERE tenant_id = $1 AND country = $2 AND state = $3 AND city = $4
      ORDER BY period DESC
      LIMIT 1
      `,
      [tenantId, region.country, region.state, region.city]
    );
    return rows[0] ?? null;
  }

  async upsertSnapshot(tenantId: string, input: UpsertSnapshotInput): Promise<RegionalImpactSnapshotRow> {
    const row = await runQueryWithTenant<RegionalImpactSnapshotRow>(
      tenantId,
      `
      INSERT INTO regional_impact_snapshots (
        tenant_id, country, state, city, period,
        total_volume_cents, total_transactions, regional_fund_inflow_cents, regional_fund_outflow_cents
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, country, state, city, period) DO UPDATE SET
        total_volume_cents = EXCLUDED.total_volume_cents,
        total_transactions = EXCLUDED.total_transactions,
        regional_fund_inflow_cents = EXCLUDED.regional_fund_inflow_cents,
        regional_fund_outflow_cents = EXCLUDED.regional_fund_outflow_cents
      RETURNING id, tenant_id, country, state, city, period, total_volume_cents, total_transactions,
                regional_fund_inflow_cents, regional_fund_outflow_cents, created_at
      `,
      [
        tenantId,
        input.country,
        input.state,
        input.city,
        input.period,
        input.totalVolumeCents,
        input.totalTransactions,
        input.regionalFundInflowCents,
        input.regionalFundOutflowCents,
      ]
    );
    if (!row) {
      throw new Error('Regional impact snapshot not upserted');
    }
    return row;
  }
}

export const regionalImpactRepository = new RegionalImpactRepository();