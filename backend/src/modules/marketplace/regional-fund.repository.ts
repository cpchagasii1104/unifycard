// backend/src/modules/marketplace/regional-fund.repository.ts
// FASE X — Bloco 2: Regional Fund (persistência apenas)

import { runQueryWithTenant, runQueriesWithTenant, pool } from '@core/database/pool';

export interface RegionalFundRow {
  id: string;
  tenant_id: string;
  country: string;
  state: string;
  city: string;
  total_balance_cents: string;
  created_at: Date;
  updated_at: Date;
}

export interface RegionalFundAllocationRow {
  id: string;
  tenant_id: string;
  regional_fund_id: string;
  actor_id: string;
  amount_cents: string;
  allocation_type: string;
  status: string;
  executed_at: Date | null;
  created_at: Date;
}

export interface CreateFundInput {
  country: string;
  state: string;
  city: string;
}

export interface AllocateInput {
  regionalFundId: string;
  actorId: string;
  amountCents: number;
  allocationType: string;
}

class RegionalFundRepository {
  getByRegion(
    tenantId: string,
    country: string,
    state: string,
    city: string
  ): Promise<RegionalFundRow | null> {
    return runQueriesWithTenant<RegionalFundRow>(
      tenantId,
      `
      SELECT id, tenant_id, country, state, city, total_balance_cents, created_at, updated_at
      FROM regional_funds
      WHERE tenant_id = $1 AND country = $2 AND state = $3 AND city = $4
      `,
      [tenantId, country, state, city]
    ).then(rows => rows[0] ?? null);
  }

  async createFund(tenantId: string, input: CreateFundInput): Promise<RegionalFundRow> {
    const row = await runQueryWithTenant<RegionalFundRow>(
      tenantId,
      `
      INSERT INTO regional_funds (tenant_id, country, state, city, total_balance_cents)
      VALUES ($1, $2, $3, $4, 0)
      ON CONFLICT (tenant_id, country, state, city) DO UPDATE SET updated_at = now()
      RETURNING id, tenant_id, country, state, city, total_balance_cents, created_at, updated_at
      `,
      [tenantId, input.country, input.state, input.city]
    );
    if (!row) {
      throw new Error('Regional fund not created');
    }
    return row;
  }

  async allocate(tenantId: string, input: AllocateInput): Promise<RegionalFundAllocationRow> {
    const client = await pool.connect();
    try {
      // 🔴 F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-FIX (2026-07-02, achado A1): is_local=TRUE, setado
      // DEPOIS do BEGIN — dentro da transação o GUC reverte sozinho no COMMIT/ROLLBACK e nunca
      // sobrevive ao client.release(); is_local=false ANTES do BEGIN ficaria preso na conexão
      // pooled além desta transação (mesma classe do achado A1 em pool.ts).
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      const fundRow = await client.query(
        `SELECT id, total_balance_cents FROM regional_funds WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
        [tenantId, input.regionalFundId]
      );
      const fund = fundRow.rows[0];
      if (!fund) {
        await client.query('ROLLBACK');
        throw new Error('Regional fund not found');
      }
      const balance = Number(fund.total_balance_cents);
      if (balance < input.amountCents) {
        await client.query('ROLLBACK');
        throw new Error('Insufficient fund balance');
      }
      await client.query(
        `UPDATE regional_funds SET total_balance_cents = total_balance_cents - $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, input.regionalFundId, input.amountCents]
      );
      const allocRow = await client.query(
        `INSERT INTO regional_fund_allocations (tenant_id, regional_fund_id, actor_id, amount_cents, allocation_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, tenant_id, regional_fund_id, actor_id, amount_cents, allocation_type, status, executed_at, created_at`,
        [tenantId, input.regionalFundId, input.actorId, input.amountCents, input.allocationType]
      );
      await client.query('COMMIT');
      return allocRow.rows[0] as RegionalFundAllocationRow;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async credit(
    tenantId: string,
    regionalFundId: string,
    amountCents: number
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE regional_funds
      SET total_balance_cents = total_balance_cents + $3, updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, regionalFundId, amountCents]
    );
  }

  async executeAllocation(
    tenantId: string,
    allocationId: string
  ): Promise<RegionalFundAllocationRow | null> {
    const row = await runQueryWithTenant<RegionalFundAllocationRow>(
      tenantId,
      `
      UPDATE regional_fund_allocations
      SET status = 'executed', executed_at = now()
      WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
      RETURNING id, tenant_id, regional_fund_id, actor_id, amount_cents, allocation_type, status, executed_at, created_at
      `,
      [allocationId, tenantId]
    );
    return row ?? null;
  }
}

export const regionalFundRepository = new RegionalFundRepository();