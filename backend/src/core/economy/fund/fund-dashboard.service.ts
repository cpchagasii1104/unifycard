// src/core/economy/fund/fund-dashboard.service.ts
// Serviço para dashboard detalhado do Fundo Regional

import { getClientWithTenant } from '../../database/pool';
import { accountService } from '../accounts/account.service';
import type { PoolClient } from 'pg';

export interface RevenueByModule {
  module: string; // 'rides', 'events', 'work', 'marketplace', etc.
  totalAmount: number; // Total recebido deste módulo
  transactionCount: number; // Quantidade de transações
  percentage: number; // Percentual do total
  lastTransactionDate?: string; // Data da última transação
}

export interface OperationalCost {
  category: string; // 'infrastructure', 'marketing', 'support', 'maintenance', etc.
  totalAmount: number; // Total gasto nesta categoria
  transactionCount: number;
  percentage: number; // Percentual do total de custos
  lastTransactionDate?: string;
}

export interface FundDashboardData {
  // Resumo básico
  summary: {
    currentBalance: number;
    totalRevenue: number; // Total que entrou
    totalCosts: number; // Total que saiu
    netBalance: number; // Saldo líquido (receitas - custos)
    period: {
      start: string;
      end: string;
      days: number;
    };
  };

  // Receitas detalhadas por módulo
  revenue: {
    byModule: RevenueByModule[];
    total: number;
    growth: {
      currentPeriod: number;
      previousPeriod: number;
      percentage: number; // Crescimento percentual
    };
  };

  // Custos operacionais
  costs: {
    byCategory: OperationalCost[];
    total: number;
    growth: {
      currentPeriod: number;
      previousPeriod: number;
      percentage: number;
    };
  };

  // Estatísticas adicionais
  statistics: {
    averageDailyRevenue: number;
    averageDailyCosts: number;
    averageTransactionValue: number;
    mostActiveModule: string; // Módulo com mais transações
    mostProfitableModule: string; // Módulo que mais gera receita
  };
}

class FundDashboardService {
  /**
   * Obtém dados completos do dashboard do Fundo Regional
   */
  async getDashboardData(
    tenantId: string,
    days: number = 30
  ): Promise<FundDashboardData> {
    let client: PoolClient | null = null;
    
    try {
      // Calcular período
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - days);
      const previousEndDate = new Date(startDate);

      // 1. Buscar conta do fundo regional
      let fundAccount;
      let currentBalance = 0;
      let fundAccountId: string | undefined;
      try {
        fundAccount = await accountService.getCommunityFundAccount(tenantId);
        currentBalance = fundAccount?.balance || 0;
        fundAccountId = fundAccount?.accountId;
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro desconhecido ao buscar conta do fundo';
        console.error('[FundDashboard] Erro ao buscar conta do fundo:', {
          tenantId,
          error: errorMessage,
          stack: error?.stack,
        });
        // Continuar mesmo sem conta - retornará valores zerados
        fundAccountId = undefined;
      }

      client = await getClientWithTenant(tenantId);
      
      // 2. Buscar receitas por módulo (transações que entraram no fundo)
      const revenueByModule = await this.getRevenueByModule(
        client,
        tenantId,
        fundAccountId,
        startDate,
        endDate
      );

      // 3. Buscar receitas do período anterior (para crescimento)
      const previousRevenueByModule = await this.getRevenueByModule(
        client,
        tenantId,
        fundAccountId,
        previousStartDate,
        previousEndDate
      );

      const totalRevenue = revenueByModule.reduce((sum, r) => sum + r.totalAmount, 0);
      const previousTotalRevenue = previousRevenueByModule.reduce(
        (sum, r) => sum + r.totalAmount,
        0
      );

      // 4. Buscar custos operacionais (transações que saíram do fundo)
      const costsByCategory = await this.getCostsByCategory(
        client,
        tenantId,
        fundAccountId,
        startDate,
        endDate
      );

      // 5. Buscar custos do período anterior
      const previousCostsByCategory = await this.getCostsByCategory(
        client,
        tenantId,
        fundAccountId,
        previousStartDate,
        previousEndDate
      );

      const totalCosts = costsByCategory.reduce((sum, c) => sum + c.totalAmount, 0);
      const previousTotalCosts = previousCostsByCategory.reduce(
        (sum, c) => sum + c.totalAmount,
        0
      );

      // 6. Calcular estatísticas
      const totalTransactions = revenueByModule.reduce(
        (sum, r) => sum + r.transactionCount,
        0
      );
      const averageDailyRevenue = totalRevenue / days;
      const averageDailyCosts = totalCosts / days;
      const averageTransactionValue =
        totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Módulo mais ativo (mais transações)
      const mostActiveModule =
        revenueByModule.length > 0
          ? revenueByModule.reduce((max, r) =>
              r.transactionCount > max.transactionCount ? r : max
            ).module
          : 'N/A';

      // Módulo mais lucrativo (mais receita)
      const mostProfitableModule =
        revenueByModule.length > 0
          ? revenueByModule.reduce((max, r) =>
              r.totalAmount > max.totalAmount ? r : max
            ).module
          : 'N/A';

      // Calcular percentuais
      revenueByModule.forEach((r) => {
        r.percentage = totalRevenue > 0 ? (r.totalAmount / totalRevenue) * 100 : 0;
      });

      costsByCategory.forEach((c) => {
        c.percentage = totalCosts > 0 ? (c.totalAmount / totalCosts) * 100 : 0;
      });

      // Commit antes de retornar (sucesso)
      if (client) {
        try {
          await client.query('COMMIT');
        } catch (commitError) {
          console.error('[FundDashboard] Erro ao fazer commit:', commitError);
          // Se falhar o commit, fazer rollback
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('[FundDashboard] Erro ao fazer rollback após falha de commit:', rollbackError);
          }
          throw commitError;
        }
      }

      return {
        summary: {
          currentBalance,
          totalRevenue,
          totalCosts,
          netBalance: totalRevenue - totalCosts,
          period: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            days,
          },
        },
        revenue: {
          byModule: revenueByModule,
          total: totalRevenue,
          growth: {
            currentPeriod: totalRevenue,
            previousPeriod: previousTotalRevenue,
            percentage:
              previousTotalRevenue > 0
                ? ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
                : 0,
          },
        },
        costs: {
          byCategory: costsByCategory,
          total: totalCosts,
          growth: {
            currentPeriod: totalCosts,
            previousPeriod: previousTotalCosts,
            percentage:
              previousTotalCosts > 0
                ? ((totalCosts - previousTotalCosts) / previousTotalCosts) * 100
                : 0,
          },
        },
        statistics: {
          averageDailyRevenue,
          averageDailyCosts,
          averageTransactionValue,
          mostActiveModule,
          mostProfitableModule,
        },
      };
    } catch (error: any) {
      // Rollback em caso de erro
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('[FundDashboard] Erro ao fazer rollback:', rollbackError);
        }
      }
      
      // Log detalhado do erro
      const errorMessage = error?.message || 'Erro desconhecido';
      const errorStack = error?.stack;
      console.error('[FundDashboard] Erro completo:', {
        tenantId,
        error: errorMessage,
        stack: errorStack,
        name: error?.name,
        code: error?.code,
      });
      
      throw error;
    } finally {
      // Liberar cliente (não fazer commit aqui, já foi feito no try ou rollback no catch)
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Busca receitas agrupadas por módulo
   */
  private async getRevenueByModule(
    client: PoolClient,
    tenantId: string,
    fundAccountId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueByModule[]> {
    if (!fundAccountId) {
      return [];
    }

    const result = await client.query<{
      module: string;
      total_amount: string | null;
      transaction_count: string;
      last_transaction_date: Date | null;
    }>(
      `
      SELECT 
        COALESCE(t.metadata->>'module', 'unknown') as module,
        COALESCE(SUM(t.amount), 0) as total_amount,
        COUNT(*) as transaction_count,
        MAX(t.created_at) as last_transaction_date
      FROM transactions t
      WHERE t.tenant_id = $1
        AND t.to_account = $2
        AND t.created_at >= $3
        AND t.created_at <= $4
      GROUP BY COALESCE(t.metadata->>'module', 'unknown')
      ORDER BY total_amount DESC
      `,
      [tenantId, fundAccountId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      module: row.module || 'unknown',
      totalAmount: parseFloat(row.total_amount || '0'),
      transactionCount: parseInt(row.transaction_count || '0'),
      percentage: 0, // Será calculado depois
      lastTransactionDate: row.last_transaction_date
        ? row.last_transaction_date.toISOString().split('T')[0]
        : undefined,
    }));
  }

  /**
   * Busca custos agrupados por categoria
   */
  private async getCostsByCategory(
    client: PoolClient,
    tenantId: string,
    fundAccountId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<OperationalCost[]> {
    if (!fundAccountId) {
      return [];
    }

    const result = await client.query<{
      category: string;
      total_amount: string | null;
      transaction_count: string;
      last_transaction_date: Date | null;
    }>(
      `
      SELECT 
        COALESCE(t.metadata->>'category', t.metadata->>'type', 'other') as category,
        COALESCE(SUM(t.amount), 0) as total_amount,
        COUNT(*) as transaction_count,
        MAX(t.created_at) as last_transaction_date
      FROM transactions t
      WHERE t.tenant_id = $1
        AND t.from_account = $2
        AND t.created_at >= $3
        AND t.created_at <= $4
      GROUP BY COALESCE(t.metadata->>'category', t.metadata->>'type', 'other')
      ORDER BY total_amount DESC
      `,
      [tenantId, fundAccountId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      category: row.category || 'other',
      totalAmount: parseFloat(row.total_amount || '0'),
      transactionCount: parseInt(row.transaction_count || '0'),
      percentage: 0, // Será calculado depois
      lastTransactionDate: row.last_transaction_date
        ? row.last_transaction_date.toISOString().split('T')[0]
        : undefined,
    }));
  }
}

export const fundDashboardService = new FundDashboardService();

