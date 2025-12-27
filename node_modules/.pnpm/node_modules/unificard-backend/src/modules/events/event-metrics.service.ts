// src/modules/events/event-metrics.service.ts
// Service para tracking de métricas de eventos
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type EventMetricType = 'VIEW' | 'CTA_CLICK' | 'CONVERSION' | 'ABANDONMENT';
export type CTAType = 'ticket' | 'consumption' | 'parking';
export type ViewSource = 'feed' | 'event_page' | 'direct';

export interface TrackMetricInput {
  tenantId: string;
  eventId: string;
  globalUserId?: string | null;
  metricType: EventMetricType;
  ctaType?: CTAType;
  source?: ViewSource;
  metadata?: Record<string, any>;
}

export interface EventMetricsSummary {
  eventId: string;
  totalViews: number;
  totalCTAClicks: number;
  totalConversions: number;
  totalAbandonments: number;
  conversionRate: number; // conversões / cliques em CTA
  ctaClickRate: number; // cliques / visualizações
  byCTAType: {
    ticket?: { clicks: number; conversions: number };
    consumption?: { clicks: number; conversions: number };
    parking?: { clicks: number; conversions: number };
  };
  bySource: {
    feed?: number;
    event_page?: number;
    direct?: number;
  };
}

export class EventMetricsService {
  /**
   * Registra uma métrica de evento
   */
  async trackMetric(input: TrackMetricInput): Promise<void> {
    const { tenantId, eventId, globalUserId, metricType, ctaType, source, metadata } = input;

    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO event_metrics (
        tenant_id,
        event_id,
        global_user_id,
        metric_type,
        cta_type,
        source,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        tenantId,
        eventId,
        globalUserId || null,
        metricType,
        ctaType || null,
        source || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ]
    );
  }

  /**
   * Busca resumo de métricas de um evento
   */
  async getEventMetricsSummary(
    tenantId: string,
    eventId: string
  ): Promise<EventMetricsSummary> {
    // Contar por tipo
    const countsByType = await runQueriesWithTenant<{
      metric_type: EventMetricType;
      count: string;
    }>(
      tenantId,
      `
      SELECT metric_type, COUNT(*) as count
      FROM event_metrics
      WHERE event_id = $1
      GROUP BY metric_type
      `,
      [eventId]
    );

    // Contar cliques por tipo de CTA
    const clicksByCTA = await runQueriesWithTenant<{
      cta_type: CTAType;
      clicks: string;
      conversions: string;
    }>(
      tenantId,
      `
      SELECT 
        cta_type,
        COUNT(*) FILTER (WHERE metric_type = 'CTA_CLICK') as clicks,
        COUNT(*) FILTER (WHERE metric_type = 'CONVERSION') as conversions
      FROM event_metrics
      WHERE event_id = $1 AND cta_type IS NOT NULL
      GROUP BY cta_type
      `,
      [eventId]
    );

    // Contar visualizações por origem
    const viewsBySource = await runQueriesWithTenant<{
      source: ViewSource;
      count: string;
    }>(
      tenantId,
      `
      SELECT source, COUNT(*) as count
      FROM event_metrics
      WHERE event_id = $1 AND metric_type = 'VIEW' AND source IS NOT NULL
      GROUP BY source
      `,
      [eventId]
    );

    // Calcular totais
    const totalViews = parseInt(
      countsByType.find((r) => r.metric_type === 'VIEW')?.count || '0',
      10
    );
    const totalCTAClicks = parseInt(
      countsByType.find((r) => r.metric_type === 'CTA_CLICK')?.count || '0',
      10
    );
    const totalConversions = parseInt(
      countsByType.find((r) => r.metric_type === 'CONVERSION')?.count || '0',
      10
    );
    const totalAbandonments = parseInt(
      countsByType.find((r) => r.metric_type === 'ABANDONMENT')?.count || '0',
      10
    );

    // Calcular taxas
    const conversionRate = totalCTAClicks > 0 ? totalConversions / totalCTAClicks : 0;
    const ctaClickRate = totalViews > 0 ? totalCTAClicks / totalViews : 0;

    // Montar resumo
    const byCTAType: EventMetricsSummary['byCTAType'] = {};
    clicksByCTA.forEach((row) => {
      byCTAType[row.cta_type] = {
        clicks: parseInt(row.clicks, 10),
        conversions: parseInt(row.conversions, 10),
      };
    });

    const bySource: EventMetricsSummary['bySource'] = {};
    viewsBySource.forEach((row) => {
      bySource[row.source] = parseInt(row.count, 10);
    });

    return {
      eventId,
      totalViews,
      totalCTAClicks,
      totalConversions,
      totalAbandonments,
      conversionRate: Math.round(conversionRate * 10000) / 100, // porcentagem com 2 casas
      ctaClickRate: Math.round(ctaClickRate * 10000) / 100,
      byCTAType,
      bySource,
    };
  }
}

export const eventMetricsService = new EventMetricsService();













