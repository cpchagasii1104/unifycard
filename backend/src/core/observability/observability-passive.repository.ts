// src/core/observability/observability-passive.repository.ts
// Repository para Observabilidade Passiva
// 🔴 BLINDAGEM: Apenas leitura e escrita de métricas agregadas
// 🔴 BLINDAGEM: NUNCA altera estado de domínio

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  CognitiveDensitySignal,
  NormalizationSignal,
  HumanConcentrationSignal,
  VisibilitySignal,
  PatternBreakSignal,
  TemporalMemorySignal,
} from './observability-passive.types';

/**
 * Repository para O-01: Densidade Cognitiva
 * 🔴 BLINDAGEM: Apenas armazena métricas agregadas
 */
export class CognitiveDensityRepository {
  async upsertSignal(tenantId: string, signal: Omit<CognitiveDensitySignal, 'signalId' | 'computedAt'>): Promise<CognitiveDensitySignal> {
    const result = await runQueryWithTenant<{
      signal_id: string;
      tenant_id: string;
      window_start: Date;
      window_end: Date;
      window_type: string;
      total_decisions_count: number;
      unique_actors_count: number;
      average_decisions_per_actor: number;
      cognitive_density_index: number;
      domain_type: string | null;
      intent_type: string | null;
      sample_size: number;
      confidence: string;
      computed_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO observability_cognitive_density (
        tenant_id, window_start, window_end, window_type,
        total_decisions_count, unique_actors_count, average_decisions_per_actor,
        cognitive_density_index, domain_type, intent_type, sample_size, confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (tenant_id, window_start, window_end, window_type, domain_type)
      DO UPDATE SET
        total_decisions_count = EXCLUDED.total_decisions_count,
        unique_actors_count = EXCLUDED.unique_actors_count,
        average_decisions_per_actor = EXCLUDED.average_decisions_per_actor,
        cognitive_density_index = EXCLUDED.cognitive_density_index,
        intent_type = EXCLUDED.intent_type,
        sample_size = EXCLUDED.sample_size,
        confidence = EXCLUDED.confidence,
        computed_at = now()
      RETURNING *
      `,
      [
        tenantId,
        signal.windowStart,
        signal.windowEnd,
        signal.windowType,
        signal.totalDecisionsCount,
        signal.uniqueActorsCount,
        signal.averageDecisionsPerActor,
        signal.cognitiveDensityIndex,
        signal.domainType || null,
        signal.intentType || null,
        signal.sampleSize,
        signal.confidence,
      ]
    );

    return this.toSignal(result);
  }

  private toSignal(row: any): CognitiveDensitySignal {
    return {
      signalId: row.signal_id,
      tenantId: row.tenant_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      windowType: row.window_type as any,
      totalDecisionsCount: Number(row.total_decisions_count),
      uniqueActorsCount: Number(row.unique_actors_count),
      averageDecisionsPerActor: Number(row.average_decisions_per_actor),
      cognitiveDensityIndex: Number(row.cognitive_density_index),
      domainType: row.domain_type || undefined,
      intentType: row.intent_type || undefined,
      sampleSize: Number(row.sample_size),
      confidence: row.confidence as any,
      computedAt: row.computed_at,
    };
  }
}

/**
 * Repository para O-02: Normalização
 * 🔴 BLINDAGEM: Apenas armazena métricas agregadas
 */
export class NormalizationRepository {
  async upsertSignal(tenantId: string, signal: Omit<NormalizationSignal, 'signalId' | 'computedAt'>): Promise<NormalizationSignal> {
    const result = await runQueryWithTenant<{
      signal_id: string;
      tenant_id: string;
      window_start: Date;
      window_end: Date;
      window_type: string;
      total_actions_count: number;
      unique_action_types_count: number;
      unique_behavioral_patterns_count: number;
      variation_index: number;
      entropy_score: number;
      domain_type: string | null;
      action_category: string | null;
      sample_size: number;
      confidence: string;
      computed_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO observability_normalization (
        tenant_id, window_start, window_end, window_type,
        total_actions_count, unique_action_types_count, unique_behavioral_patterns_count,
        variation_index, entropy_score, domain_type, action_category, sample_size, confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id, window_start, window_end, window_type, domain_type)
      DO UPDATE SET
        total_actions_count = EXCLUDED.total_actions_count,
        unique_action_types_count = EXCLUDED.unique_action_types_count,
        unique_behavioral_patterns_count = EXCLUDED.unique_behavioral_patterns_count,
        variation_index = EXCLUDED.variation_index,
        entropy_score = EXCLUDED.entropy_score,
        action_category = EXCLUDED.action_category,
        sample_size = EXCLUDED.sample_size,
        confidence = EXCLUDED.confidence,
        computed_at = now()
      RETURNING *
      `,
      [
        tenantId,
        signal.windowStart,
        signal.windowEnd,
        signal.windowType,
        signal.totalActionsCount,
        signal.uniqueActionTypesCount,
        signal.uniqueBehavioralPatternsCount,
        signal.variationIndex,
        signal.entropyScore,
        signal.domainType || null,
        signal.actionCategory || null,
        signal.sampleSize,
        signal.confidence,
      ]
    );

    return this.toSignal(result);
  }

  private toSignal(row: any): NormalizationSignal {
    return {
      signalId: row.signal_id,
      tenantId: row.tenant_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      windowType: row.window_type as any,
      totalActionsCount: Number(row.total_actions_count),
      uniqueActionTypesCount: Number(row.unique_action_types_count),
      uniqueBehavioralPatternsCount: Number(row.unique_behavioral_patterns_count),
      variationIndex: Number(row.variation_index),
      entropyScore: Number(row.entropy_score),
      domainType: row.domain_type || undefined,
      actionCategory: row.action_category || undefined,
      sampleSize: Number(row.sample_size),
      confidence: row.confidence as any,
      computedAt: row.computed_at,
    };
  }
}

/**
 * Repository para O-03: Concentração Humana
 * 🔴 BLINDAGEM: Apenas armazena métricas agregadas (nunca identifica indivíduos)
 */
export class HumanConcentrationRepository {
  async upsertSignal(tenantId: string, signal: Omit<HumanConcentrationSignal, 'signalId' | 'computedAt'>): Promise<HumanConcentrationSignal> {
    const result = await runQueryWithTenant<{
      signal_id: string;
      tenant_id: string;
      window_start: Date;
      window_end: Date;
      window_type: string;
      total_interactions_count: number;
      unique_actors_count: number;
      gini_coefficient: number;
      concentration_index: number;
      top_percentile_share: number | null;
      interaction_type: string | null;
      domain_type: string | null;
      sample_size: number;
      confidence: string;
      computed_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO observability_human_concentration (
        tenant_id, window_start, window_end, window_type,
        total_interactions_count, unique_actors_count, gini_coefficient,
        concentration_index, top_percentile_share, interaction_type, domain_type,
        sample_size, confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id, window_start, window_end, window_type, interaction_type)
      DO UPDATE SET
        total_interactions_count = EXCLUDED.total_interactions_count,
        unique_actors_count = EXCLUDED.unique_actors_count,
        gini_coefficient = EXCLUDED.gini_coefficient,
        concentration_index = EXCLUDED.concentration_index,
        top_percentile_share = EXCLUDED.top_percentile_share,
        domain_type = EXCLUDED.domain_type,
        sample_size = EXCLUDED.sample_size,
        confidence = EXCLUDED.confidence,
        computed_at = now()
      RETURNING *
      `,
      [
        tenantId,
        signal.windowStart,
        signal.windowEnd,
        signal.windowType,
        signal.totalInteractionsCount,
        signal.uniqueActorsCount,
        signal.giniCoefficient,
        signal.concentrationIndex,
        signal.topPercentileShare || null,
        signal.interactionType || null,
        signal.domainType || null,
        signal.sampleSize,
        signal.confidence,
      ]
    );

    return this.toSignal(result);
  }

  private toSignal(row: any): HumanConcentrationSignal {
    return {
      signalId: row.signal_id,
      tenantId: row.tenant_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      windowType: row.window_type as any,
      totalInteractionsCount: Number(row.total_interactions_count),
      uniqueActorsCount: Number(row.unique_actors_count),
      giniCoefficient: Number(row.gini_coefficient),
      concentrationIndex: Number(row.concentration_index),
      topPercentileShare: row.top_percentile_share ? Number(row.top_percentile_share) : undefined,
      interactionType: row.interaction_type || undefined,
      domainType: row.domain_type || undefined,
      sampleSize: Number(row.sample_size),
      confidence: row.confidence as any,
      computedAt: row.computed_at,
    };
  }
}

/**
 * Repository para O-04: Visibilidade
 * 🔴 BLINDAGEM: Apenas armazena métricas agregadas (nunca rebalanceia feed)
 */
export class VisibilityRepository {
  async upsertSignal(tenantId: string, signal: Omit<VisibilitySignal, 'signalId' | 'computedAt'>): Promise<VisibilitySignal> {
    const result = await runQueryWithTenant<{
      signal_id: string;
      tenant_id: string;
      window_start: Date;
      window_end: Date;
      window_type: string;
      total_views_count: number;
      unique_content_items_count: number;
      unique_viewers_count: number;
      attention_gini_coefficient: number;
      visibility_index: number;
      long_tail_share: number | null;
      content_type: string | null;
      feed_section: string | null;
      sample_size: number;
      confidence: string;
      computed_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO observability_visibility (
        tenant_id, window_start, window_end, window_type,
        total_views_count, unique_content_items_count, unique_viewers_count,
        attention_gini_coefficient, visibility_index, long_tail_share,
        content_type, feed_section, sample_size, confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (tenant_id, window_start, window_end, window_type, content_type)
      DO UPDATE SET
        total_views_count = EXCLUDED.total_views_count,
        unique_content_items_count = EXCLUDED.unique_content_items_count,
        unique_viewers_count = EXCLUDED.unique_viewers_count,
        attention_gini_coefficient = EXCLUDED.attention_gini_coefficient,
        visibility_index = EXCLUDED.visibility_index,
        long_tail_share = EXCLUDED.long_tail_share,
        feed_section = EXCLUDED.feed_section,
        sample_size = EXCLUDED.sample_size,
        confidence = EXCLUDED.confidence,
        computed_at = now()
      RETURNING *
      `,
      [
        tenantId,
        signal.windowStart,
        signal.windowEnd,
        signal.windowType,
        signal.totalViewsCount,
        signal.uniqueContentItemsCount,
        signal.uniqueViewersCount,
        signal.attentionGiniCoefficient,
        signal.visibilityIndex,
        signal.longTailShare || null,
        signal.contentType || null,
        signal.feedSection || null,
        signal.sampleSize,
        signal.confidence,
      ]
    );

    return this.toSignal(result);
  }

  private toSignal(row: any): VisibilitySignal {
    return {
      signalId: row.signal_id,
      tenantId: row.tenant_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      windowType: row.window_type as any,
      totalViewsCount: Number(row.total_views_count),
      uniqueContentItemsCount: Number(row.unique_content_items_count),
      uniqueViewersCount: Number(row.unique_viewers_count),
      attentionGiniCoefficient: Number(row.attention_gini_coefficient),
      visibilityIndex: Number(row.visibility_index),
      longTailShare: row.long_tail_share ? Number(row.long_tail_share) : undefined,
      contentType: row.content_type || undefined,
      feedSection: row.feed_section || undefined,
      sampleSize: Number(row.sample_size),
      confidence: row.confidence as any,
      computedAt: row.computed_at,
    };
  }
}

/**
 * Repository para O-05: Quebra de Padrão
 * 🔴 BLINDAGEM: Apenas armazena métricas agregadas (nunca induz escolha)
 */
export class PatternBreakRepository {
  async upsertSignal(tenantId: string, signal: Omit<PatternBreakSignal, 'signalId' | 'computedAt'>): Promise<PatternBreakSignal> {
    const result = await runQueryWithTenant<{
      signal_id: string;
      tenant_id: string;
      window_start: Date;
      window_end: Date;
      window_type: string;
      total_actions_count: number;
      expected_pattern_actions_count: number;
      pattern_break_actions_count: number;
      pattern_break_index: number;
      semantic_variation_score: number;
      domain_type: string | null;
      pattern_type: string | null;
      sample_size: number;
      confidence: string;
      computed_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO observability_pattern_break (
        tenant_id, window_start, window_end, window_type,
        total_actions_count, expected_pattern_actions_count, pattern_break_actions_count,
        pattern_break_index, semantic_variation_score, domain_type, pattern_type,
        sample_size, confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id, window_start, window_end, window_type, domain_type, pattern_type)
      DO UPDATE SET
        total_actions_count = EXCLUDED.total_actions_count,
        expected_pattern_actions_count = EXCLUDED.expected_pattern_actions_count,
        pattern_break_actions_count = EXCLUDED.pattern_break_actions_count,
        pattern_break_index = EXCLUDED.pattern_break_index,
        semantic_variation_score = EXCLUDED.semantic_variation_score,
        sample_size = EXCLUDED.sample_size,
        confidence = EXCLUDED.confidence,
        computed_at = now()
      RETURNING *
      `,
      [
        tenantId,
        signal.windowStart,
        signal.windowEnd,
        signal.windowType,
        signal.totalActionsCount,
        signal.expectedPatternActionsCount,
        signal.patternBreakActionsCount,
        signal.patternBreakIndex,
        signal.semanticVariationScore,
        signal.domainType || null,
        signal.patternType || null,
        signal.sampleSize,
        signal.confidence,
      ]
    );

    return this.toSignal(result);
  }

  private toSignal(row: any): PatternBreakSignal {
    return {
      signalId: row.signal_id,
      tenantId: row.tenant_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      windowType: row.window_type as any,
      totalActionsCount: Number(row.total_actions_count),
      expectedPatternActionsCount: Number(row.expected_pattern_actions_count),
      patternBreakActionsCount: Number(row.pattern_break_actions_count),
      patternBreakIndex: Number(row.pattern_break_index),
      semanticVariationScore: Number(row.semantic_variation_score),
      domainType: row.domain_type || undefined,
      patternType: row.pattern_type || undefined,
      sampleSize: Number(row.sample_size),
      confidence: row.confidence as any,
      computedAt: row.computed_at,
    };
  }
}

/**
 * Repository para O-06: Memória Temporal
 * 🔴 BLINDAGEM: Apenas armazena métricas agregadas (nunca moraliza passado)
 */
export class TemporalMemoryRepository {
  async upsertSignal(tenantId: string, signal: Omit<TemporalMemorySignal, 'signalId' | 'computedAt'>): Promise<TemporalMemorySignal> {
    const result = await runQueryWithTenant<{
      signal_id: string;
      tenant_id: string;
      window_start: Date;
      window_end: Date;
      window_type: string;
      metric_type: string;
      metric_value: number;
      previous_period_value: number | null;
      trend_direction: string | null;
      trend_strength: number;
      moving_average: number | null;
      domain_type: string | null;
      aggregation_level: string | null;
      sample_size: number;
      confidence: string;
      computed_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO observability_temporal_memory (
        tenant_id, window_start, window_end, window_type,
        metric_type, metric_value, previous_period_value,
        trend_direction, trend_strength, moving_average,
        domain_type, aggregation_level, sample_size, confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (tenant_id, window_start, window_end, window_type, metric_type, domain_type)
      DO UPDATE SET
        metric_value = EXCLUDED.metric_value,
        previous_period_value = EXCLUDED.previous_period_value,
        trend_direction = EXCLUDED.trend_direction,
        trend_strength = EXCLUDED.trend_strength,
        moving_average = EXCLUDED.moving_average,
        aggregation_level = EXCLUDED.aggregation_level,
        sample_size = EXCLUDED.sample_size,
        confidence = EXCLUDED.confidence,
        computed_at = now()
      RETURNING *
      `,
      [
        tenantId,
        signal.windowStart,
        signal.windowEnd,
        signal.windowType,
        signal.metricType,
        signal.metricValue,
        signal.previousPeriodValue || null,
        signal.trendDirection || null,
        signal.trendStrength,
        signal.movingAverage || null,
        signal.domainType || null,
        signal.aggregationLevel || null,
        signal.sampleSize,
        signal.confidence,
      ]
    );

    return this.toSignal(result);
  }

  private toSignal(row: any): TemporalMemorySignal {
    return {
      signalId: row.signal_id,
      tenantId: row.tenant_id,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      windowType: row.window_type as any,
      metricType: row.metric_type,
      metricValue: Number(row.metric_value),
      previousPeriodValue: row.previous_period_value ? Number(row.previous_period_value) : undefined,
      trendDirection: row.trend_direction as any,
      trendStrength: Number(row.trend_strength),
      movingAverage: row.moving_average ? Number(row.moving_average) : undefined,
      domainType: row.domain_type || undefined,
      aggregationLevel: row.aggregation_level as any,
      sampleSize: Number(row.sample_size),
      confidence: row.confidence as any,
      computedAt: row.computed_at,
    };
  }
}

// Instâncias singleton
export const cognitiveDensityRepository = new CognitiveDensityRepository();
export const normalizationRepository = new NormalizationRepository();
export const humanConcentrationRepository = new HumanConcentrationRepository();
export const visibilityRepository = new VisibilityRepository();
export const patternBreakRepository = new PatternBreakRepository();
export const temporalMemoryRepository = new TemporalMemoryRepository();

