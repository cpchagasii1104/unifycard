"use strict";
// src/core/insight/insight.service.ts
// Serviço de insights - coordena geração de insights
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightService = void 0;
const insight_engine_1 = require("./insight-engine");
const event_log_source_1 = require("../simulation/event-log.source");
const policy_registry_1 = require("../policy/policy-registry");
const policy_resolution_engine_1 = require("../policy-resolution/policy-resolution-engine");
const decision_log_service_1 = require("../decision-log/decision-log.service");
/**
 * Serviço de insights
 * Coordena busca de dados e geração de insights
 */
class InsightService {
    /**
     * Gera insights para um tenant e período
     * Opcionalmente pode receber contexto para resolução dinâmica de políticas
     */
    async generateInsightsForPeriod(tenantId, days = 30, context) {
        // Calcular período
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Buscar eventos canônicos do período
        const canonicalEvents = await event_log_source_1.eventLogSource.listEvents({
            tenantId,
            sourceModule: 'work',
            startDate,
            endDate,
        });
        // Buscar políticas relevantes
        const policies = policy_registry_1.policyRegistry.listPolicies();
        // Se contexto fornecido, resolver políticas dinamicamente
        // (para uso futuro em insights que dependem de valores resolvidos)
        if (context) {
            // Exemplo: resolver split regional com contexto
            const resolvedSplit = await policy_resolution_engine_1.policyResolutionEngine.resolvePolicy('economy', 'regional_split_percentage', context);
            // Pode ser usado em insights futuros que precisam de valores resolvidos
        }
        // Preparar input
        const input = {
            canonicalEvents,
            policies,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
        };
        // Gerar insights
        const insights = insight_engine_1.insightEngine.generateInsights(input);
        // Registrar observações no decision log (se houver insights relevantes)
        for (const insight of insights) {
            if (insight.domain === 'fund' || insight.domain === 'economy') {
                // Registrar observação para insights de fundo/economia
                try {
                    await decision_log_service_1.decisionLogService.createObservation(insight.domain, 'regional_split_percentage', // Policy key relevante
                    {
                        regionId: insight.data.regionId,
                    }, policy_registry_1.policyRegistry.getPolicyValue('economy', 'regional_split_percentage', 0.10 // Fallback explícito
                    ) || 0.10, // Valor atual da policy lido do registry
                    {
                        insightsUsed: [
                            {
                                insightId: insight.id,
                                insightType: insight.type,
                                message: insight.message,
                            },
                        ],
                        metadata: {
                            insightSeverity: insight.severity,
                            insightData: insight.data,
                        },
                    });
                }
                catch (error) {
                    // Continuar mesmo se falhar (modo read-only)
                    console.warn('[InsightService] Erro ao registrar observação:', error);
                }
            }
        }
        return insights;
    }
    /**
     * Gera insights focados em um domínio específico
     */
    async generateInsightsByDomain(tenantId, domain, days = 30) {
        const allInsights = await this.generateInsightsForPeriod(tenantId, days);
        return allInsights.filter((insight) => insight.domain === domain);
    }
}
exports.insightService = new InsightService();
