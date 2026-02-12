// src/core/observability/observability-passive.projector.ts
// Projector Passivo para Observabilidade (Contratos O-01 a O-06)
// 🔴 BLINDAGEM: Apenas calcula métricas agregadas
// 🔴 BLINDAGEM: Apenas armazena séries temporais
// 🔴 BLINDAGEM: NUNCA dispara ações
// 🔴 BLINDAGEM: NUNCA altera estado de domínio

import type { UnificardEvent } from '@core/events/event-bus';
import { ActorEffect } from '@core/social/ports';
import {
  cognitiveDensityRepository,
  normalizationRepository,
  humanConcentrationRepository,
  visibilityRepository,
  patternBreakRepository,
  temporalMemoryRepository,
} from './observability-passive.repository';
import type {
  CognitiveDensitySignal,
  NormalizationSignal,
  HumanConcentrationSignal,
  VisibilitySignal,
  PatternBreakSignal,
  TemporalMemorySignal,
} from './observability-passive.types';

/**
 * Projector Passivo para Observabilidade
 * 🔴 BLINDAGEM: Apenas projeta métricas, nunca executa ações
 */
export class ObservabilityPassiveProjector {
  /**
   * Projeta sinal O-01: Densidade Cognitiva
   * Observa carga decisória agregada (nunca indivíduos)
   * 
   * 🔴 BLINDAGEM: Apenas calcula métricas agregadas
   * 🔴 BLINDAGEM: NUNCA identifica indivíduos
   * 🔴 BLINDAGEM: NUNCA dispara ações
   */
  async projectCognitiveDensity(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    windowType: 'hour' | 'day' | 'week' | 'month',
    data: {
      totalDecisionsCount: number;
      uniqueActorsCount: number;
      domainType?: string;
      intentType?: string;
      sampleSize: number;
    }
  ): Promise<CognitiveDensitySignal> {
    // 🔴 BLINDAGEM: Calcular apenas métricas agregadas
    const averageDecisionsPerActor = data.uniqueActorsCount > 0
      ? data.totalDecisionsCount / data.uniqueActorsCount
      : 0;

    // 🔴 BLINDAGEM: Densidade cognitiva é apenas índice (0-1)
    // Não representa eficiência ou qualidade
    const cognitiveDensityIndex = Math.min(1, averageDecisionsPerActor / 10); // Normalizado para 0-1

    // 🔴 BLINDAGEM: Determinar confiança baseado em tamanho da amostra
    const confidence = data.sampleSize >= 100 ? 'high' :
                      data.sampleSize >= 50 ? 'medium' :
                      data.sampleSize >= 10 ? 'low' : 'insufficient';

    const signal: Omit<CognitiveDensitySignal, 'signalId' | 'computedAt'> = {
      tenantId,
      windowStart,
      windowEnd,
      windowType,
      totalDecisionsCount: data.totalDecisionsCount,
      uniqueActorsCount: data.uniqueActorsCount,
      averageDecisionsPerActor,
      cognitiveDensityIndex,
      domainType: data.domainType,
      intentType: data.intentType,
      sampleSize: data.sampleSize,
      confidence,
    };

    return await cognitiveDensityRepository.upsertSignal(tenantId, signal);
  }

  /**
   * Projeta sinal O-02: Normalização
   * Observa perda de variação comportamental (nunca eficiência)
   * 
   * 🔴 BLINDAGEM: Apenas calcula métricas agregadas
   * 🔴 BLINDAGEM: NUNCA mede eficiência
   * 🔴 BLINDAGEM: NUNCA dispara ações
   */
  async projectNormalization(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    windowType: 'hour' | 'day' | 'week' | 'month',
    data: {
      totalActionsCount: number;
      uniqueActionTypesCount: number;
      uniqueBehavioralPatternsCount: number;
      domainType?: string;
      actionCategory?: string;
      sampleSize: number;
    }
  ): Promise<NormalizationSignal> {
    // 🔴 BLINDAGEM: Calcular apenas métricas de variação
    // Variação = 1 - (normalização)
    // Normalização = proporção de ações que seguem padrão dominante
    const variationIndex = data.totalActionsCount > 0
      ? Math.min(1, data.uniqueBehavioralPatternsCount / data.totalActionsCount)
      : 0;

    // 🔴 BLINDAGEM: Entropia comportamental (Shannon)
    // Mede diversidade, não eficiência
    const entropyScore = data.uniqueActionTypesCount > 0
      ? -Math.log2(data.uniqueActionTypesCount / data.totalActionsCount) * (data.uniqueActionTypesCount / data.totalActionsCount)
      : 0;

    const confidence = data.sampleSize >= 100 ? 'high' :
                      data.sampleSize >= 50 ? 'medium' :
                      data.sampleSize >= 10 ? 'low' : 'insufficient';

    const signal: Omit<NormalizationSignal, 'signalId' | 'computedAt'> = {
      tenantId,
      windowStart,
      windowEnd,
      windowType,
      totalActionsCount: data.totalActionsCount,
      uniqueActionTypesCount: data.uniqueActionTypesCount,
      uniqueBehavioralPatternsCount: data.uniqueBehavioralPatternsCount,
      variationIndex,
      entropyScore,
      domainType: data.domainType,
      actionCategory: data.actionCategory,
      sampleSize: data.sampleSize,
      confidence,
    };

    return await normalizationRepository.upsertSignal(tenantId, signal);
  }

  /**
   * Projeta sinal O-03: Concentração Humana
   * Observa centralidade emergente (nunca nomeia pessoas)
   * 
   * 🔴 BLINDAGEM: Apenas calcula métricas agregadas
   * 🔴 BLINDAGEM: NUNCA identifica indivíduos
   * 🔴 BLINDAGEM: NUNCA dispara ações
   */
  async projectHumanConcentration(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    windowType: 'hour' | 'day' | 'week' | 'month',
    data: {
      totalInteractionsCount: number;
      uniqueActorsCount: number;
      interactionsDistribution: number[]; // Distribuição de interações por ator (sem identificar quem)
      interactionType?: string;
      domainType?: string;
      sampleSize: number;
    }
  ): Promise<HumanConcentrationSignal> {
    // 🔴 BLINDAGEM: Calcular Gini apenas com distribuição agregada
    // NUNCA identificar indivíduos específicos
    const giniCoefficient = this.calculateGini(data.interactionsDistribution);

    // 🔴 BLINDAGEM: Índice de concentração (0-1)
    const concentrationIndex = giniCoefficient;

    // 🔴 BLINDAGEM: Participação do top 10% (sem identificar quem)
    const sorted = [...data.interactionsDistribution].sort((a, b) => b - a);
    const top10PercentCount = Math.ceil(sorted.length * 0.1);
    const top10PercentSum = sorted.slice(0, top10PercentCount).reduce((sum, val) => sum + val, 0);
    const totalSum = sorted.reduce((sum, val) => sum + val, 0);
    const topPercentileShare = totalSum > 0 ? top10PercentSum / totalSum : 0;

    const confidence = data.sampleSize >= 100 ? 'high' :
                      data.sampleSize >= 50 ? 'medium' :
                      data.sampleSize >= 10 ? 'low' : 'insufficient';

    const signal: Omit<HumanConcentrationSignal, 'signalId' | 'computedAt'> = {
      tenantId,
      windowStart,
      windowEnd,
      windowType,
      totalInteractionsCount: data.totalInteractionsCount,
      uniqueActorsCount: data.uniqueActorsCount,
      giniCoefficient,
      concentrationIndex,
      topPercentileShare,
      interactionType: data.interactionType,
      domainType: data.domainType,
      sampleSize: data.sampleSize,
      confidence,
    };

    return await humanConcentrationRepository.upsertSignal(tenantId, signal);
  }

  /**
   * Projeta sinal O-04: Visibilidade
   * Observa distribuição de atenção (nunca rebalanceia feed)
   * 
   * 🔴 BLINDAGEM: Apenas calcula métricas agregadas
   * 🔴 BLINDAGEM: NUNCA rebalanceia feed
   * 🔴 BLINDAGEM: NUNCA dispara ações
   */
  async projectVisibility(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    windowType: 'hour' | 'day' | 'week' | 'month',
    data: {
      totalViewsCount: number;
      uniqueContentItemsCount: number;
      uniqueViewersCount: number;
      viewsDistribution: number[]; // Distribuição de views por item (sem identificar itens)
      contentType?: string;
      feedSection?: string;
      sampleSize: number;
    }
  ): Promise<VisibilitySignal> {
    // 🔴 BLINDAGEM: Calcular Gini da distribuição de atenção
    const attentionGiniCoefficient = this.calculateGini(data.viewsDistribution);

    // 🔴 BLINDAGEM: Índice de visibilidade (0-1)
    // 0 = atenção concentrada, 1 = atenção distribuída
    const visibilityIndex = 1 - attentionGiniCoefficient;

    // 🔴 BLINDAGEM: Participação da cauda longa (sem identificar itens)
    const sorted = [...data.viewsDistribution].sort((a, b) => b - a);
    const longTailStart = Math.ceil(sorted.length * 0.1); // Após top 10%
    const longTailSum = sorted.slice(longTailStart).reduce((sum, val) => sum + val, 0);
    const totalSum = sorted.reduce((sum, val) => sum + val, 0);
    const longTailShare = totalSum > 0 ? longTailSum / totalSum : 0;

    const confidence = data.sampleSize >= 100 ? 'high' :
                      data.sampleSize >= 50 ? 'medium' :
                      data.sampleSize >= 10 ? 'low' : 'insufficient';

    const signal: Omit<VisibilitySignal, 'signalId' | 'computedAt'> = {
      tenantId,
      windowStart,
      windowEnd,
      windowType,
      totalViewsCount: data.totalViewsCount,
      uniqueContentItemsCount: data.uniqueContentItemsCount,
      uniqueViewersCount: data.uniqueViewersCount,
      attentionGiniCoefficient,
      visibilityIndex,
      longTailShare,
      contentType: data.contentType,
      feedSection: data.feedSection,
      sampleSize: data.sampleSize,
      confidence,
    };

    return await visibilityRepository.upsertSignal(tenantId, signal);
  }

  /**
   * Projeta sinal O-05: Quebra de Padrão
   * Permite variação semântica neutra (nunca induz escolha)
   * 
   * 🔴 BLINDAGEM: Apenas calcula métricas agregadas
   * 🔴 BLINDAGEM: NUNCA induz escolha
   * 🔴 BLINDAGEM: NUNCA dispara ações
   */
  async projectPatternBreak(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    windowType: 'hour' | 'day' | 'week' | 'month',
    data: {
      totalActionsCount: number;
      expectedPatternActionsCount: number;
      patternBreakActionsCount: number;
      semanticVariations: string[]; // Variações semânticas (neutras)
      domainType?: string;
      patternType?: string;
      sampleSize: number;
    }
  ): Promise<PatternBreakSignal> {
    // 🔴 BLINDAGEM: Calcular apenas métricas de quebra de padrão
    const patternBreakIndex = data.totalActionsCount > 0
      ? data.patternBreakActionsCount / data.totalActionsCount
      : 0;

    // 🔴 BLINDAGEM: Variação semântica (neutra, sem julgamento)
    const uniqueSemanticVariations = new Set(data.semanticVariations).size;
    const semanticVariationScore = data.semanticVariations.length > 0
      ? uniqueSemanticVariations / data.semanticVariations.length
      : 0;

    const confidence = data.sampleSize >= 100 ? 'high' :
                      data.sampleSize >= 50 ? 'medium' :
                      data.sampleSize >= 10 ? 'low' : 'insufficient';

    const signal: Omit<PatternBreakSignal, 'signalId' | 'computedAt'> = {
      tenantId,
      windowStart,
      windowEnd,
      windowType,
      totalActionsCount: data.totalActionsCount,
      expectedPatternActionsCount: data.expectedPatternActionsCount,
      patternBreakActionsCount: data.patternBreakActionsCount,
      patternBreakIndex,
      semanticVariationScore,
      domainType: data.domainType,
      patternType: data.patternType,
      sampleSize: data.sampleSize,
      confidence,
    };

    return await patternBreakRepository.upsertSignal(tenantId, signal);
  }

  /**
   * Projeta sinal O-06: Memória Temporal
   * Observa tendências longas (nunca moraliza passado)
   * 
   * 🔴 BLINDAGEM: Apenas calcula métricas agregadas
   * 🔴 BLINDAGEM: NUNCA moraliza passado
   * 🔴 BLINDAGEM: NUNCA dispara ações
   */
  async projectTemporalMemory(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date,
    windowType: 'week' | 'month' | 'quarter' | 'year',
    data: {
      metricType: string;
      metricValue: number;
      previousPeriodValue?: number;
      historicalValues: number[]; // Valores históricos para média móvel
      domainType?: string;
      aggregationLevel?: 'tenant' | 'city' | 'global';
      sampleSize: number;
    }
  ): Promise<TemporalMemorySignal> {
    // 🔴 BLINDAGEM: Calcular apenas tendências (sem julgamento)
    let trendDirection: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';
    let trendStrength = 0;

    if (data.previousPeriodValue !== undefined) {
      const change = data.metricValue - data.previousPeriodValue;
      const changePercent = data.previousPeriodValue > 0 ? Math.abs(change / data.previousPeriodValue) : 0;

      if (changePercent < 0.05) {
        trendDirection = 'stable';
        trendStrength = 0;
      } else if (changePercent > 0.2) {
        trendDirection = 'volatile';
        trendStrength = Math.min(1, changePercent);
      } else if (change > 0) {
        trendDirection = 'increasing';
        trendStrength = Math.min(1, changePercent);
      } else {
        trendDirection = 'decreasing';
        trendStrength = Math.min(1, changePercent);
      }
    }

    // 🔴 BLINDAGEM: Média móvel (se houver histórico)
    const movingAverage = data.historicalValues.length > 0
      ? data.historicalValues.reduce((sum, val) => sum + val, 0) / data.historicalValues.length
      : undefined;

    const confidence = data.sampleSize >= 100 ? 'high' :
                      data.sampleSize >= 50 ? 'medium' :
                      data.sampleSize >= 10 ? 'low' : 'insufficient';

    const signal: Omit<TemporalMemorySignal, 'signalId' | 'computedAt'> = {
      tenantId,
      windowStart,
      windowEnd,
      windowType,
      metricType: data.metricType,
      metricValue: data.metricValue,
      previousPeriodValue: data.previousPeriodValue,
      trendDirection,
      trendStrength,
      movingAverage,
      domainType: data.domainType,
      aggregationLevel: data.aggregationLevel,
      sampleSize: data.sampleSize,
      confidence,
    };

    return await temporalMemoryRepository.upsertSignal(tenantId, signal);
  }

  /**
   * Calcula coeficiente de Gini
   * 🔴 BLINDAGEM: Apenas cálculo matemático, não identifica indivíduos
   */
  private calculateGini(distribution: number[]): number {
    if (distribution.length === 0 || distribution.every(v => v === 0)) {
      return 0;
    }

    const sorted = [...distribution].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((s, v) => s + v, 0);

    if (sum === 0) {
      return 0;
    }

    let numerator = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        numerator += Math.abs(sorted[i] - sorted[j]);
      }
    }

    const denominator = 2 * n * sum;
    return denominator > 0 ? numerator / denominator : 0;
  }
}

// Instância singleton
export const observabilityPassiveProjector = new ObservabilityPassiveProjector();

