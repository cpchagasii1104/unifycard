// src/core/economy/fund/fund.service.ts

import { accountService } from '../accounts/account.service';
import { transactionService } from '../transactions/transaction.service';
import { tenantService } from '../../tenants/tenant.service';
import { worldService } from '../../world/services/world.service';
import { regionAccountService } from '../region-account.service';
import { getClientWithTenant } from '@core/database/pool';
import type { Transaction } from '../transactions/transaction.types';

export interface FundSummary {
  regionId: string;
  balance: number;
  transactions: number;
  sources: {
    work: number;
  };
  lastUpdated: string;
}

export interface FundHistoryEntry {
  date: string; // YYYY-MM-DD
  amountCents: number;
}

class FundService {
  /**
   * Obtém resumo do fundo regional
   */
  async getSummary(tenantId: string): Promise<FundSummary> {
    // 1. Obter região do tenant
    const tenant = await tenantService.getTenantById(tenantId);
    let regionId = 'unknown';
    if (tenant?.cityId) {
      const cityPath = await worldService.getCityFullPath(tenant.cityId);
      if (cityPath?.state?.stateId) {
        regionId = cityPath.state.stateId;
      }
    }

    // 2. Resolver conta de região (pode ser conta 'group' criada pelo regionAccountService)
    const regionAccountId = await regionAccountService.resolveRegionAccountId({
      tenantId,
    });

    if (!regionAccountId) {
      // Se não há conta de região, retornar valores zerados
      return {
        regionId,
        balance: 0,
        transactions: 0,
        sources: {
          work: 0,
        },
        lastUpdated: new Date().toISOString(),
      };
    }

    // 3. Obter saldo da conta de região
    const balance = await accountService.getBalance(tenantId, regionAccountId);

    // 4. Buscar transações da conta de região
    const client = await getClientWithTenant(tenantId);
    try {
      // Buscar transações onde to_account é a conta de região e metadata indica split REGION do módulo work
      const result = await client.query<{
        transaction_id: string;
        amountCents: string;
        createdAt: Date;
        metadata: any;
      }>(
        `
        SELECT transaction_id, amount, createdAt, metadata
        FROM transactions
        WHERE to_account = $1
          AND metadata->>'module' = 'work'
          AND metadata->>'splitTargetType' = 'REGION'
        ORDER BY createdAt DESC
        LIMIT 1000
        `,
        [regionAccountId]
      );

      const allTransactions = result.rows;
      const workTotal = allTransactions.reduce((sum, row) => sum + parseFloat(row.amount), 0);

      // Obter última atualização
      const lastTransaction = allTransactions[0];
      const lastUpdated = lastTransaction?.createdAt
        ? lastTransaction.createdAt.toISOString()
        : new Date().toISOString();

      return {
        regionId,
        balance,
        transactions: allTransactions.length,
        sources: {
          work: workTotal,
        },
        lastUpdated,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Obtém histórico do fundo regional agregado por dia
   */
  async getHistory(tenantId: string, rangeDays: number = 30): Promise<FundHistoryEntry[]> {
    // 1. Resolver conta de região
    const regionAccountId = await regionAccountService.resolveRegionAccountId({
      tenantId,
    });

    if (!regionAccountId) {
      return [];
    }

    // 2. Buscar transações agregadas por dia
    const client = await getClientWithTenant(tenantId);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - rangeDays);

      // Buscar transações onde to_account é a conta de região, metadata.module = 'work' e splitTargetType = 'REGION'
      const result = await client.query<{
        date: string;
        amountCents: string;
      }>(
        `
        SELECT 
          DATE(createdAt) as date,
          SUM(amount) as amount
        FROM transactions
        WHERE to_account = $1
          AND metadata->>'module' = 'work'
          AND metadata->>'splitTargetType' = 'REGION'
          AND createdAt >= $2
          AND createdAt <= $3
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
        `,
        [regionAccountId, startDate, endDate]
      );

      // Converter para formato esperado
      const history: FundHistoryEntry[] = result.rows.map((row) => ({
        date: row.date,
        amountCents: parseFloat(row.amount),
      }));

      return history;
    } finally {
      client.release();
    }
  }
}

export const fundService = new FundService();



