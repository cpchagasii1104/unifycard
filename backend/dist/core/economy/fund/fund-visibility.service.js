"use strict";
// src/core/economy/fund/fund-visibility.service.ts
// Serviço READ-ONLY para tornar o Fundo Regional visível
// Combina fundService + insightService para projeções
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundVisibilityService = void 0;
const fund_service_1 = require("./fund.service");
const insight_service_1 = require("../../insight/insight.service");
const policy_registry_1 = require("../../policy/policy-registry");
const tenant_service_1 = require("../../tenants/tenant.service");
const world_service_1 = require("../../world/services/world.service");
const region_account_service_1 = require("../region-account.service");
const pool_1 = require("../../database/pool");
class FundVisibilityService {
    /**
     * Obtém resumo do Fundo Regional com DTO claro
     */
    async getSummary(tenantId) {
        // Obter dados do fundService existente
        const summary = await fund_service_1.fundService.getSummary(tenantId);
        // Obter nome da região (se disponível)
        let regionName;
        try {
            if (summary.regionId !== 'unknown') {
                const region = await world_service_1.worldService.getStateById(summary.regionId);
                regionName = region?.name;
            }
        }
        catch {
            // Ignorar erro - regionName pode ficar undefined
        }
        // Obter percentuais do Policy Registry
        const regionPercentage = policy_registry_1.policyRegistry.getPolicyValue('economy', 'split_region_percentage', 0.10) || 0.10;
        const workerPercentage = policy_registry_1.policyRegistry.getPolicyValue('economy', 'split_worker_percentage', 0.70) || 0.70;
        const platformPercentage = policy_registry_1.policyRegistry.getPolicyValue('economy', 'split_tenant_percentage', 0.15) || 0.15;
        const groupsPercentage = policy_registry_1.policyRegistry.getPolicyValue('economy', 'split_group_percentage', 0.05) || 0.05;
        // Construir resposta (omitir regionId se "unknown")
        const response = {
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
    async getHistory(tenantId, rangeDays = 30) {
        // Obter dados do fundService existente
        const historyEntries = await fund_service_1.fundService.getHistory(tenantId, rangeDays);
        // Obter região do tenant
        const tenant = await tenant_service_1.tenantService.getTenantById(tenantId);
        let regionId = 'unknown';
        if (tenant?.cityId) {
            const cityPath = await world_service_1.worldService.getCityFullPath(tenant.cityId);
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
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({ tenantId });
        let entries = historyEntries.map((entry) => ({
            date: entry.date,
            amount: entry.amount,
            transactionCount: 0, // Será preenchido abaixo
        }));
        if (regionAccountId) {
            const client = await (0, pool_1.getClientWithTenant)(tenantId);
            try {
                const countResult = await client.query(`
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
          `, [regionAccountId, startDate, endDate]);
                // Mapear contagens para entradas
                const countMap = new Map();
                countResult.rows.forEach((row) => {
                    countMap.set(row.date, parseInt(row.count, 10));
                });
                entries = entries.map((entry) => ({
                    ...entry,
                    transactionCount: countMap.get(entry.date) || 0,
                }));
            }
            catch (error) {
                // Se falhar, manter transactionCount = 0
                console.warn('[FundVisibilityService] Erro ao contar transações:', error);
            }
            finally {
                client.release();
            }
        }
        const totalInPeriod = entries.reduce((sum, e) => sum + e.amount, 0);
        // Gerar label do período
        let periodLabel = `Últimos ${rangeDays} dias`;
        if (rangeDays === 7)
            periodLabel = 'Últimos 7 dias';
        else if (rangeDays === 30)
            periodLabel = 'Últimos 30 dias';
        else if (rangeDays === 90)
            periodLabel = 'Últimos 90 dias';
        else if (rangeDays === 365)
            periodLabel = 'Último ano';
        const response = {
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
    async getProjection(tenantId) {
        // Obter resumo atual
        const summary = await this.getSummary(tenantId);
        // Gerar insights de projeção (últimos 30 dias)
        const insights = await insight_service_1.insightService.generateInsightsByDomain(tenantId, 'fund', 30);
        // Buscar insight de projeção
        const projectionInsight = insights.find((i) => i.type === 'projection');
        let dailyAverage = 0;
        let daysAnalyzed = 30;
        let projection30Days = 0;
        let projection90Days = 0;
        if (projectionInsight && projectionInsight.data) {
            dailyAverage = projectionInsight.data.dailyAverage || 0;
            daysAnalyzed = projectionInsight.data.daysAnalyzed || 30;
            projection30Days = projectionInsight.data.projection30Days || 0;
            projection90Days = projectionInsight.data.projection90Days || 0;
        }
        else {
            // Fallback: calcular média simples dos últimos 30 dias do histórico
            const history = await this.getHistory(tenantId, 30);
            if (history.entries.length > 0) {
                const totalAmount = history.totalInPeriod;
                dailyAverage = totalAmount / history.period.days;
                daysAnalyzed = history.period.days;
                // Projeção linear: média diária * dias * 10% (percentual do fundo)
                const percentage = policy_registry_1.policyRegistry.getPolicyValue('economy', 'split_region_percentage', 0.10) || 0.10;
                projection30Days = dailyAverage * 30 * percentage;
                projection90Days = dailyAverage * 90 * percentage;
            }
        }
        const response = {
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
            disclaimer: 'Estimativa baseada na média dos últimos dias. Valores reais podem ser diferentes.',
        };
        return response;
    }
    /**
     * Obtém visão completa do Fundo Regional
     * Combina resumo, histórico e projeção
     */
    async getCompleteView(tenantId, historyDays = 30) {
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
exports.fundVisibilityService = new FundVisibilityService();
//# sourceMappingURL=fund-visibility.service.js.map