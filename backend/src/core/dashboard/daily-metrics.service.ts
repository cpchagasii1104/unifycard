// src/core/dashboard/daily-metrics.service.ts
// Service para métricas diárias do sistema
import { pool } from '@core/database/pool';
import { logger } from '../logging/logger';

export interface DailyMetrics {
  date: string;
  operational: {
    uptime: number; // % (calculado externamente)
    avgResponseTime: number; // ms
    errorRate: number; // %
    webhookSuccessRate: number; // %
  };
  business: {
    activeOrganizers: number;
    totalEvents: number;
    activeSubscriptions: number;
    totalRevenue: number; // R$
    conversionRate: number; // % (views → conversions)
  };
  feedback: {
    issuesReported: number;
    featureRequests: number;
  };
}

export class DailyMetricsService {
  /**
   * Calcula métricas do dia atual
   */
  async getTodayMetrics(): Promise<DailyMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Métricas operacionais (precisam ser calculadas externamente via monitoramento)
    const operational = {
      uptime: 0, // Preencher via monitoramento externo
      avgResponseTime: 0, // Preencher via APM
      errorRate: 0, // Preencher via logs
      webhookSuccessRate: await this.calculateWebhookSuccessRate(today, tomorrow),
    };

    // Métricas de negócio
    const business = {
      activeOrganizers: await this.countActiveOrganizers(),
      totalEvents: await this.countEventsCreated(today, tomorrow),
      activeSubscriptions: await this.countActiveSubscriptions(),
      totalRevenue: await this.calculateTodayRevenue(today, tomorrow),
      conversionRate: await this.calculateConversionRate(today, tomorrow),
    };

    // Métricas de feedback (precisam de sistema de tickets/feedback)
    const feedback = {
      issuesReported: 0, // Preencher via sistema de tickets
      featureRequests: 0, // Preencher via sistema de tickets
    };

    return {
      date: today.toISOString().split('T')[0],
      operational,
      business,
      feedback,
    };
  }

  /**
   * Calcula métricas dos últimos N dias
   */
  async getMetricsHistory(days: number = 7): Promise<DailyMetrics[]> {
    const metrics: DailyMetrics[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayMetrics = await this.getMetricsForDate(date, nextDate);
      metrics.push(dayMetrics);
    }

    return metrics;
  }

  private async getMetricsForDate(start: Date, end: Date): Promise<DailyMetrics> {
    const operational = {
      uptime: 0,
      avgResponseTime: 0,
      errorRate: 0,
      webhookSuccessRate: await this.calculateWebhookSuccessRate(start, end),
    };

    const business = {
      activeOrganizers: await this.countActiveOrganizers(),
      totalEvents: await this.countEventsCreated(start, end),
      activeSubscriptions: await this.countActiveSubscriptions(),
      totalRevenue: await this.calculateTodayRevenue(start, end),
      conversionRate: await this.calculateConversionRate(start, end),
    };

    const feedback = {
      issuesReported: 0,
      featureRequests: 0,
    };

    return {
      date: start.toISOString().split('T')[0],
      operational,
      business,
      feedback,
    };
  }

  private async calculateWebhookSuccessRate(start: Date, end: Date): Promise<number> {
    // Buscar logs de webhook (assumindo que são logados)
    // Por enquanto, retorna 100% (placeholder)
    return 100;
  }

  private async countActiveOrganizers(): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `
      SELECT COUNT(DISTINCT id) as count
      FROM event_organizers
      WHERE created_at >= NOW() - INTERVAL '30 days'
      `
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async countEventsCreated(start: Date, end: Date): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM events
      WHERE created_at >= $1 AND created_at < $2
      `,
      [start, end]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async countActiveSubscriptions(): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM organizer_subscriptions
      WHERE status = 'active'
        AND current_period_end > NOW()
      `
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async calculateTodayRevenue(start: Date, end: Date): Promise<number> {
    // Buscar assinaturas criadas no período
    // Por enquanto, retorna 0 (precisa integrar com Stripe para valores reais)
    return 0;
  }

  private async calculateConversionRate(start: Date, end: Date): Promise<number> {
    // Buscar métricas de eventos
    const viewsResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM event_metrics
      WHERE type = 'VIEW'
        AND created_at >= $1 AND created_at < $2
      `,
      [start, end]
    );

    const conversionsResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM event_metrics
      WHERE type = 'CONVERSION'
        AND created_at >= $1 AND created_at < $2
      `,
      [start, end]
    );

    const views = parseInt(viewsResult.rows[0]?.count || '0', 10);
    const conversions = parseInt(conversionsResult.rows[0]?.count || '0', 10);

    if (views === 0) return 0;

    return (conversions / views) * 100;
  }
}

export const dailyMetricsService = new DailyMetricsService();



























