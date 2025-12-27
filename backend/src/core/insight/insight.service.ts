// src/core/insight/insight.service.ts
// Serviço de insights - coordena geração de insights

import { insightEngine } from './insight-engine';
import type { Insight, InsightInput } from './insight.types';
import { eventLogSource } from '../simulation/event-log.source';
import { policyRegistry } from '../policy/policy-registry';
import { policyResolutionEngine } from '../policy-resolution/policy-resolution-engine';
import type { PolicyContext } from '../policy-resolution/policy-resolution.types';
import { decisionLogService } from '../decision-log/decision-log.service';

/**
 * Serviço de insights
 * Coordena busca de dados e geração de insights
 */
class InsightService {
  /**
   * Gera insights para um tenant e período
   * Opcionalmente pode receber contexto para resolução dinâmica de políticas
   */
  async generateInsightsForPeriod(
    tenantId: string,
    days: number = 30,
    context?: PolicyContext
  ): Promise<Insight[]> {
    // Calcular período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Buscar eventos canônicos do período
    const canonicalEvents = await eventLogSource.listEvents({
      tenantId,
      sourceModule: 'work',
      startDate,
      endDate,
    });

    // Buscar políticas relevantes
    const policies = policyRegistry.listPolicies();

    // Se contexto fornecido, resolver políticas dinamicamente
    // (para uso futuro em insights que dependem de valores resolvidos)
    if (context) {
      // Exemplo: resolver split regional com contexto
      const resolvedSplit = await policyResolutionEngine.resolvePolicy(
        'economy',
        'regional_split_percentage',
        context
      );
      // Pode ser usado em insights futuros que precisam de valores resolvidos
    }

    // Preparar input
    const input: InsightInput = {
      canonicalEvents,
      policies,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    // Gerar insights
    const insights = insightEngine.generateInsights(input);

    // Registrar observações no decision log (se houver insights relevantes)
    for (const insight of insights) {
      if (insight.domain === 'fund' || insight.domain === 'economy') {
        // Registrar observação para insights de fundo/economia
        try {
          await decisionLogService.createObservation(
            insight.domain,
            'regional_split_percentage', // Policy key relevante
            {
              regionId: insight.data.regionId as string | undefined,
            },
            policyRegistry.getPolicyValue<number>(
              'economy',
              'regional_split_percentage',
              0.10 // Fallback explícito
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
            }
          );
        } catch (error) {
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
  async generateInsightsByDomain(
    tenantId: string,
    domain: Insight['domain'],
    days: number = 30
  ): Promise<Insight[]> {
    const allInsights = await this.generateInsightsForPeriod(tenantId, days);
    return allInsights.filter((insight) => insight.domain === domain);
  }
}

export const insightService = new InsightService();

