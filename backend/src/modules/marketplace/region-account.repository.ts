// backend/src/modules/marketplace/region-account.repository.ts
// SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { RegionAccount } from './settlement.types';

interface RegionAccountRow {
  id: string;
  tenant_id: string;
  region_id: string;
  balance_cents: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

class RegionAccountRepository {
  private toRegionAccount(row: RegionAccountRow): RegionAccount {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      regionId: row.region_id,
      balanceCents: row.balance_cents,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getOrCreateAccount(
    tenantId: string,
    regionId: string,
    currency: string = 'BRL'
  ): Promise<RegionAccount> {
    // Tentar buscar conta existente
    const existing = await this.getAccount(tenantId, regionId, currency);
    if (existing) {
      return existing;
    }

    // Criar nova conta
    const row = await runQueryWithTenant<RegionAccountRow>(
      tenantId,
      `
      INSERT INTO region_accounts (
        tenant_id, region_id, balance_cents, currency
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, region_id, currency) DO UPDATE SET updated_at = NOW()
      RETURNING id, tenant_id, region_id, balance_cents, currency,
                created_at, updated_at
      `,
      [tenantId, regionId, 0, currency]
    );

    if (!row) {
      throw new Error('Erro ao criar conta regional');
    }

    return this.toRegionAccount(row);
  }

  async getAccount(
    tenantId: string,
    regionId: string,
    currency: string = 'BRL'
  ): Promise<RegionAccount | null> {
    const rows = await runQueriesWithTenant<RegionAccountRow>(
      tenantId,
      `
      SELECT id, tenant_id, region_id, balance_cents, currency,
             created_at, updated_at
      FROM region_accounts
      WHERE tenant_id = $1 AND region_id = $2 AND currency = $3
      `,
      [tenantId, regionId, currency]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toRegionAccount(rows[0]);
  }

  async credit(
    tenantId: string,
    regionId: string,
    amountCents: number,
    currency: string = 'BRL'
  ): Promise<RegionAccount> {
    const row = await runQueryWithTenant<RegionAccountRow>(
      tenantId,
      `
      UPDATE region_accounts
      SET balance_cents = balance_cents + $4,
          updated_at = NOW()
      WHERE tenant_id = $1 AND region_id = $2 AND currency = $3
      RETURNING id, tenant_id, region_id, balance_cents, currency,
                created_at, updated_at
      `,
      [tenantId, regionId, currency, amountCents]
    );

    if (!row) {
      throw new Error('Conta regional não encontrada');
    }

    return this.toRegionAccount(row);
  }

  async debit(
    tenantId: string,
    regionId: string,
    amountCents: number,
    currency: string = 'BRL'
  ): Promise<RegionAccount> {
    const row = await runQueryWithTenant<RegionAccountRow>(
      tenantId,
      `
      UPDATE region_accounts
      SET balance_cents = balance_cents - $4,
          updated_at = NOW()
      WHERE tenant_id = $1 AND region_id = $2 AND currency = $3
        AND balance_cents >= $4
      RETURNING id, tenant_id, region_id, balance_cents, currency,
                created_at, updated_at
      `,
      [tenantId, regionId, currency, amountCents]
    );

    if (!row) {
      throw new Error('Conta regional não encontrada ou saldo insuficiente');
    }

    return this.toRegionAccount(row);
  }
}

export const regionAccountRepository = new RegionAccountRepository();





