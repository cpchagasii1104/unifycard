// src/core/economy/fund/fund-admin.service.ts
// Serviço interno para observação do fundo por região (admin/dev)

import { accountService } from '../accounts/account.service';
import { getClientWithTenant } from '@core/database/pool';
import { worldService } from '../../world/services/world.service';

export interface RegionFundData {
  regionId: string;
  regionName?: string;
  accountId: string;
  balance: number;
  totalAccumulated: number;
  transactionCount: number;
  growth7Days: number;
  growth30Days: number;
  lastTransactionDate?: string;
}

export interface RegionFundExport {
  regionId: string;
  regionName?: string;
  balance: number;
  totalAccumulated: number;
  transactionCount: number;
  growth7Days: number;
  growth30Days: number;
  lastTransactionDate?: string;
  exportDate: string;
}

class FundAdminService {
  /**
   * Lista todas as regiões com dados agregados do fundo
   */
  async listAllRegions(tenantId: string): Promise<RegionFundData[]> {
    const client = await getClientWithTenant(tenantId);
    
    try {
      // 1. Buscar todas as contas tipo 'group' (contas de região) do tenant
      const regionAccounts = await client.query<{
        account_id: string;
        owner_id: string;
        balance: string;
      }>(
        `
        SELECT account_id, owner_id, balance
        FROM accounts
        WHERE tenant_id = $1
          AND owner_type = 'group'
          AND currency = 'BRL'
        ORDER BY balance DESC
        `,
        [tenantId]
      );

      const regions: RegionFundData[] = [];

      // 2. Para cada conta de região, calcular métricas
      for (const account of regionAccounts.rows) {
        const regionId = account.owner_id;
        const accountId = account.account_id;
        const balance = parseFloat(account.balance);

        // Buscar nome da região (stateId)
        let regionName: string | undefined;
        try {
          const state = await worldService.getStateById(regionId);
          regionName = state?.name || undefined;
        } catch {
          regionName = undefined;
        }

        // Calcular datas
        const now = new Date();
        const date7DaysAgo = new Date(now);
        date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
        const date30DaysAgo = new Date(now);
        date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

        // Buscar transações agregadas
        const transactionsResult = await client.query<{
          total_amount: string;
          transaction_count: string;
          last_transaction_date: Date | null;
          amount_7d: string;
          amount_30d: string;
        }>(
          `
          SELECT 
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as transaction_count,
            MAX(created_at) as last_transaction_date,
            COALESCE(SUM(CASE WHEN created_at >= $1 THEN amount ELSE 0 END), 0) as amount_7d,
            COALESCE(SUM(CASE WHEN created_at >= $2 THEN amount ELSE 0 END), 0) as amount_30d
          FROM transactions
          WHERE tenant_id = $4
            AND to_account = $3
            AND metadata->>'module' = 'work'
            AND metadata->>'splitTargetType' = 'REGION'
          `,
          [date7DaysAgo, date30DaysAgo, accountId, tenantId]
        );

        const row = transactionsResult.rows[0];
        const totalAccumulated = parseFloat(row.total_amount || '0');
        const transactionCount = parseInt(row.transaction_count || '0', 10);
        const growth7Days = parseFloat(row.amount_7d || '0');
        const growth30Days = parseFloat(row.amount_30d || '0');
        const lastTransactionDate = row.last_transaction_date
          ? row.last_transaction_date.toISOString()
          : undefined;

        regions.push({
          regionId,
          regionName,
          accountId,
          balance,
          totalAccumulated,
          transactionCount,
          growth7Days,
          growth30Days,
          lastTransactionDate,
        });
      }

      return regions;
    } finally {
      client.release();
    }
  }

  /**
   * Exporta dados do fundo por região (CSV/JSON)
   */
  async exportRegionsData(tenantId: string): Promise<RegionFundExport[]> {
    const regions = await this.listAllRegions(tenantId);
    const exportDate = new Date().toISOString();

    return regions.map((region) => ({
      regionId: region.regionId,
      regionName: region.regionName,
      balance: region.balance,
      totalAccumulated: region.totalAccumulated,
      transactionCount: region.transactionCount,
      growth7Days: region.growth7Days,
      growth30Days: region.growth30Days,
      lastTransactionDate: region.lastTransactionDate,
      exportDate,
    }));
  }
}

export const fundAdminService = new FundAdminService();

