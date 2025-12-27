// src/core/economy/fund/fund-visibility.service.ts
// Serviço READ-ONLY para tornar o Fundo Regional visível
// Combina fundService + insightService para projeções

import { fundService, type FundSummary, type FundHistoryEntry } from './fund.service';
import { insightService } from '../../insight/insight.service';
import { policyRegistry } from '../../policy/policy-registry';
import { tenantService } from '../../tenants/tenant.service';
import { worldService } from '../../world/services/world.service';
import { regionAccountService } from '../region-account.service';
import { getClientWithTenant } from '../../database/pool';
import type {
  RegionalFundSummary,
  RegionalFundHistory,
  RegionalFundProjection,
  RegionalFundView,
} from './fund.types';

class FundVisibilityService {
  /**
   * Obtém resumo do Fundo Regional com DTO claro
   */
  async getSummary(tenantId: string): Promise<RegionalFundSummary> {
    // Obter dados do fundService existente
    const summary = await fundService.getSummary(tenantId);

    // Obter nome da região (se disponível)
    let regionName: string | undefined;
    try {
      if (summary.regionId !== 'unknown') {
        const region = await worldService.getStateById(summary.regionId);
        regionName = region?.name;
      }
    } catch {
      // Ignorar erro - regionName pode ficar undefined
    }

    // Obter percentuais do Policy Registry
    const regionPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_region_percentage',
      0.10
    ) || 0.10;

    const workerPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_worker_percentage',
      0.70
    ) || 0.70;

    const platformPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_tenant_percentage',
      0.15
    ) || 0.15;

    const groupsPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_group_percentage',
      0.05
    ) || 0.05;

    // Construir resposta (omitir regionId se "unknown")
    const response: RegionalFundSummary = {
      ...(summary.regionId !== 'unknown' && { regionId: summary.regionId }),
      ...(regionName && { regionName }),
      currentBalance: summary.balance,
      totalContributions: summary.transactions,
      totalReceived: summary.sources.work,
      fromServices: {
        work: summary.sources.work,
      },
      lastUpdated: summary.lastUpdated,
      explanation: {
        text: '10% de cada transação nesta cidade vai para o Fundo Regional.',
        example: `Exemplo: se uma transação for R$ 100, R$ ${(100 * regionPercentage).toFixed(0)} vai para o fundo.`,
      },
      splitBreakdown: {
        worker: Math.round(workerPercentage * 100), // 70 ao invés de 0.70
        platform: Math.round(platformPercentage * 100), // 15 ao invés de 0.15
        regionalFund: Math.round(regionPercentage * 100), // 10 ao invés de 0.10
        community: Math.round(groupsPercentage * 100), // 5 ao invés de 0.05
      },
    };

    return response;
  }

  /**
   * Obtém histórico do Fundo Regional com DTO claro
   */
  async getHistory(tenantId: string, rangeDays: number = 30): Promise<RegionalFundHistory> {
    // Obter dados do fundService existente
    const historyEntries = await fundService.getHistory(tenantId, rangeDays);

    // Obter região do tenant
    const tenant = await tenantService.getTenantById(tenantId);
    let regionId = 'unknown';
    if (tenant?.cityId) {
      const cityPath = await worldService.getCityFullPath(tenant.cityId);
      if (cityPath?.state?.stateId) {
        regionId = cityPath.state.stateId;
      }
    }

    // Calcular período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeDays);

    // Agregar por dia com contagem de transações
    // Buscar contagem real de transações por dia
    const regionAccountId = await regionAccountService.resolveRegionAccountId({ tenantId });
    
    let entries = historyEntries.map((entry) => ({
      date: entry.date,
      amount: entry.amount,
      transactionCount: 0, // Será preenchido abaixo
    }));

    if (regionAccountId) {
      const client = await getClientWithTenant(tenantId);
      try {
        const countResult = await client.query<{
          date: string;
          count: string;
        }>(
          `
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::text as count
          FROM transactions
          WHERE to_account = $1
            AND metadata->>'module' = 'work'
            AND metadata->>'splitTargetType' = 'REGION'
            AND created_at >= $2
            AND created_at <= $3
          GROUP BY DATE(created_at)
          ORDER BY date ASC
          `,
          [regionAccountId, startDate, endDate]
        );

        // Mapear contagens para entradas
        const countMap = new Map<string, number>();
        countResult.rows.forEach((row) => {
          countMap.set(row.date, parseInt(row.count, 10));
        });

        entries = entries.map((entry) => ({
          ...entry,
          transactionCount: countMap.get(entry.date) || 0,
        }));
      } catch (error) {
        // Se falhar, manter transactionCount = 0
        console.warn('[FundVisibilityService] Erro ao contar transações:', error);
      } finally {
        client.release();
      }
    }

    const totalInPeriod = entries.reduce((sum, e) => sum + e.amount, 0);

    // Gerar label do período
    let periodLabel = `Últimos ${rangeDays} dias`;
    if (rangeDays === 7) periodLabel = 'Últimos 7 dias';
    else if (rangeDays === 30) periodLabel = 'Últimos 30 dias';
    else if (rangeDays === 90) periodLabel = 'Últimos 90 dias';
    else if (rangeDays === 365) periodLabel = 'Último ano';

    const response: RegionalFundHistory = {
      ...(regionId !== 'unknown' && { regionId }),
      entries,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: rangeDays,
        label: periodLabel,
      },
      totalInPeriod,
    };

    return response;
  }

  /**
   * Obtém projeção do Fundo Regional baseada em insights
   */
  async getProjection(tenantId: string): Promise<RegionalFundProjection> {
    // Obter resumo atual
    const summary = await this.getSummary(tenantId);

    // Gerar insights de projeção (últimos 30 dias)
    const insights = await insightService.generateInsightsByDomain(tenantId, 'fund', 30);

    // Buscar insight de projeção
    const projectionInsight = insights.find((i) => i.type === 'projection');

    let dailyAverage = 0;
    let daysAnalyzed = 30;
    let projection30Days = 0;
    let projection90Days = 0;

    if (projectionInsight && projectionInsight.data) {
      dailyAverage = (projectionInsight.data.dailyAverage as number) || 0;
      daysAnalyzed = (projectionInsight.data.daysAnalyzed as number) || 30;
      projection30Days = (projectionInsight.data.projection30Days as number) || 0;
      projection90Days = (projectionInsight.data.projection90Days as number) || 0;
    } else {
      // Fallback: calcular média simples dos últimos 30 dias do histórico
      const history = await this.getHistory(tenantId, 30);
      if (history.entries.length > 0) {
        const totalAmount = history.totalInPeriod;
        dailyAverage = totalAmount / history.period.days;
        daysAnalyzed = history.period.days;

        // Projeção linear: média diária * dias * 10% (percentual do fundo)
        const percentage = policyRegistry.getPolicyValue<number>(
          'economy',
          'split_region_percentage',
          0.10
        ) || 0.10;

        projection30Days = dailyAverage * 30 * percentage;
        projection90Days = dailyAverage * 90 * percentage;
      }
    }

    const response: RegionalFundProjection = {
      ...(summary.regionId && summary.regionId !== 'unknown' && { regionId: summary.regionId }),
      currentBalance: summary.currentBalance,
      dailyAverage,
      daysAnalyzed,
      estimates: {
        in30Days: {
          estimatedBalance: summary.currentBalance + projection30Days,
          estimatedIncrease: projection30Days,
        },
        in90Days: {
          estimatedBalance: summary.currentBalance + projection90Days,
          estimatedIncrease: projection90Days,
        },
      },
      calculatedAt: new Date().toISOString(),
      disclaimer:
        'Estimativa baseada na média dos últimos dias. Valores reais podem ser diferentes.',
    };

    return response;
  }

  /**
   * Obtém visão completa do Fundo Regional
   * Combina resumo, histórico e projeção
   */
  async getCompleteView(tenantId: string, historyDays: number = 30): Promise<RegionalFundView> {
    const [summary, history, projection] = await Promise.all([
      this.getSummary(tenantId),
      this.getHistory(tenantId, historyDays),
      this.getProjection(tenantId),
    ]);

    return {
      summary,
      history,
      projection,
    };
  }
}

export const fundVisibilityService = new FundVisibilityService();

