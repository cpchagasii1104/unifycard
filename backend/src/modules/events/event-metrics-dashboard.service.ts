// src/modules/events/event-metrics-dashboard.service.ts
// Service para dashboard de métricas de eventos
import { runQueriesWithTenant } from '@core/database/pool';
import { eventStateService } from './event-state.service';

export interface EventMetricsDashboard {
  eventId: string;
  eventTitle: string;
  eventState: 'PRE' | 'DURING' | 'POST';
  metrics: {
    totalViews: number;
    totalCTAClicks: number;
    totalConversions: number;
    totalAbandonments: number;
    conversionRate: number;
    ctaClickRate: number;
  };
  byState: {
    PRE?: { views: number; clicks: number; conversions: number };
    DURING?: { views: number; clicks: number; conversions: number };
    POST?: { views: number; clicks: number; conversions: number };
  };
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
  funnel: {
    views: number;
    ctaClicks: number;
    conversions: number;
    dropOffViewsToClicks: number; // % que não clicou
    dropOffClicksToConversion: number; // % que não converteu
  };
}

export interface EventsComparison {
  events: Array<{
    eventId: string;
    title: string;
    state: 'PRE' | 'DURING' | 'POST';
    conversionRate: number;
    ctaClickRate: number;
    totalViews: number;
    totalConversions: number;
  }>;
  averageConversionRate: number;
  averageCTAClickRate: number;
  topPerformer?: {
    eventId: string;
    title: string;
    conversionRate: number;
  };
}

export class EventMetricsDashboardService {
  /**
   * Busca dashboard completo de métricas de um evento
   */
  async getEventDashboard(
    tenantId: string,
    eventId: string
  ): Promise<EventMetricsDashboard | null> {
    // Buscar evento
    const eventRow = await runQueriesWithTenant<any>(
      tenantId,
      `
      SELECT id, title, starts_at, ends_at, status
      FROM events
      WHERE id = $1
      `,
      [eventId]
    );

    if (!eventRow || eventRow.length === 0) {
      return null;
    }

    const event = eventRow[0];
    const stateInfo = eventStateService.getEventState({
      startTime: event.starts_at,
      endTime: event.ends_at,
      status: event.status,
    });

    // Buscar métricas totais
    const totalMetrics = await runQueriesWithTenant<{
      metric_type: string;
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

    // Buscar métricas por estado (usando timestamps)
    const metricsByState = await runQueriesWithTenant<{
      state: string;
      metric_type: string;
      count: string;
    }>(
      tenantId,
      `
      WITH event_times AS (
        SELECT starts_at, ends_at, status
        FROM events
        WHERE id = $1
      ),
      metrics_with_state AS (
        SELECT 
          em.metric_type,
          em.created_at,
          CASE
            WHEN em.created_at < et.starts_at THEN 'PRE'
            WHEN em.created_at >= et.starts_at AND em.created_at <= et.ends_at THEN 'DURING'
            WHEN em.created_at > et.ends_at OR et.status = 'FINISHED' THEN 'POST'
            ELSE 'UNKNOWN'
          END as state
        FROM event_metrics em
        CROSS JOIN event_times et
        WHERE em.event_id = $1
      )
      SELECT state, metric_type, COUNT(*) as count
      FROM metrics_with_state
      WHERE state != 'UNKNOWN'
      GROUP BY state, metric_type
      `,
      [eventId]
    );

    // Buscar por tipo de CTA
    const byCTA = await runQueriesWithTenant<{
      cta_type: string;
      metric_type: string;
      count: string;
    }>(
      tenantId,
      `
      SELECT cta_type, metric_type, COUNT(*) as count
      FROM event_metrics
      WHERE event_id = $1 AND cta_type IS NOT NULL
      GROUP BY cta_type, metric_type
      `,
      [eventId]
    );

    // Buscar por source
    const bySource = await runQueriesWithTenant<{
      source: string;
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
      totalMetrics.find((r) => r.metric_type === 'VIEW')?.count || '0',
      10
    );
    const totalCTAClicks = parseInt(
      totalMetrics.find((r) => r.metric_type === 'CTA_CLICK')?.count || '0',
      10
    );
    const totalConversions = parseInt(
      totalMetrics.find((r) => r.metric_type === 'CONVERSION')?.count || '0',
      10
    );
    const totalAbandonments = parseInt(
      totalMetrics.find((r) => r.metric_type === 'ABANDONMENT')?.count || '0',
      10
    );

    const conversionRate = totalCTAClicks > 0 ? (totalConversions / totalCTAClicks) * 100 : 0;
    const ctaClickRate = totalViews > 0 ? (totalCTAClicks / totalViews) * 100 : 0;

    // Montar byState
    const byState: EventMetricsDashboard['byState'] = {};
    metricsByState.forEach((row) => {
      if (!byState[row.state as 'PRE' | 'DURING' | 'POST']) {
        byState[row.state as 'PRE' | 'DURING' | 'POST'] = {
          views: 0,
          clicks: 0,
          conversions: 0,
        };
      }
      if (row.metric_type === 'VIEW') {
        byState[row.state as 'PRE' | 'DURING' | 'POST']!.views = parseInt(row.count, 10);
      } else if (row.metric_type === 'CTA_CLICK') {
        byState[row.state as 'PRE' | 'DURING' | 'POST']!.clicks = parseInt(row.count, 10);
      } else if (row.metric_type === 'CONVERSION') {
        byState[row.state as 'PRE' | 'DURING' | 'POST']!.conversions = parseInt(row.count, 10);
      }
    });

    // Montar byCTAType
    const byCTAType: EventMetricsDashboard['byCTAType'] = {};
    byCTA.forEach((row) => {
      if (!byCTAType[row.cta_type as 'ticket' | 'consumption' | 'parking']) {
        byCTAType[row.cta_type as 'ticket' | 'consumption' | 'parking'] = {
          clicks: 0,
          conversions: 0,
        };
      }
      if (row.metric_type === 'CTA_CLICK') {
        byCTAType[row.cta_type as 'ticket' | 'consumption' | 'parking']!.clicks = parseInt(
          row.count,
          10
        );
      } else if (row.metric_type === 'CONVERSION') {
        byCTAType[row.cta_type as 'ticket' | 'consumption' | 'parking']!.conversions = parseInt(
          row.count,
          10
        );
      }
    });

    // Montar bySource
    const bySourceMap: EventMetricsDashboard['bySource'] = {};
    bySource.forEach((row) => {
      bySourceMap[row.source as 'feed' | 'event_page' | 'direct'] = parseInt(row.count, 10);
    });

    // Calcular funil
    const dropOffViewsToClicks =
      totalViews > 0 ? ((totalViews - totalCTAClicks) / totalViews) * 100 : 0;
    const dropOffClicksToConversion =
      totalCTAClicks > 0 ? ((totalCTAClicks - totalConversions) / totalCTAClicks) * 100 : 0;

    return {
      eventId,
      eventTitle: event.title,
      eventState: stateInfo.state,
      metrics: {
        totalViews,
        totalCTAClicks,
        totalConversions,
        totalAbandonments,
        conversionRate: Math.round(conversionRate * 100) / 100,
        ctaClickRate: Math.round(ctaClickRate * 100) / 100,
      },
      byState,
      byCTAType,
      bySource: bySourceMap,
      funnel: {
        views: totalViews,
        ctaClicks: totalCTAClicks,
        conversions: totalConversions,
        dropOffViewsToClicks: Math.round(dropOffViewsToClicks * 100) / 100,
        dropOffClicksToConversion: Math.round(dropOffClicksToConversion * 100) / 100,
      },
    };
  }

  /**
   * Compara métricas entre eventos
   */
  async compareEvents(
    tenantId: string,
    eventIds: string[]
  ): Promise<EventsComparison> {
    if (eventIds.length === 0) {
      return {
        events: [],
        averageConversionRate: 0,
        averageCTAClickRate: 0,
      };
    }

    const events = await Promise.all(
      eventIds.map(async (eventId) => {
        const dashboard = await this.getEventDashboard(tenantId, eventId);
        if (!dashboard) return null;

        return {
          eventId: dashboard.eventId,
          title: dashboard.eventTitle,
          state: dashboard.eventState,
          conversionRate: dashboard.metrics.conversionRate,
          ctaClickRate: dashboard.metrics.ctaClickRate,
          totalViews: dashboard.metrics.totalViews,
          totalConversions: dashboard.metrics.totalConversions,
        };
      })
    );

    const validEvents = events.filter((e): e is NonNullable<typeof e> => e !== null);

    const averageConversionRate =
      validEvents.length > 0
        ? validEvents.reduce((sum, e) => sum + e.conversionRate, 0) / validEvents.length
        : 0;

    const averageCTAClickRate =
      validEvents.length > 0
        ? validEvents.reduce((sum, e) => sum + e.ctaClickRate, 0) / validEvents.length
        : 0;

    const topPerformer = validEvents.reduce(
      (top, current) => (current.conversionRate > (top?.conversionRate || 0) ? current : top),
      null as (typeof validEvents)[0] | null
    );

    return {
      events: validEvents,
      averageConversionRate: Math.round(averageConversionRate * 100) / 100,
      averageCTAClickRate: Math.round(averageCTAClickRate * 100) / 100,
      topPerformer: topPerformer
        ? {
            eventId: topPerformer.eventId,
            title: topPerformer.title,
            conversionRate: topPerformer.conversionRate,
          }
        : undefined,
    };
  }
}

export const eventMetricsDashboardService = new EventMetricsDashboardService();




























