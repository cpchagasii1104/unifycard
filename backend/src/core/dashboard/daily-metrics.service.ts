// src/core/dashboard/daily-metrics.service.ts
// Service para métricas diárias do sistema.
//
// 🔒 B4f (F-DASHBOARD-METRICS-TENANT-SCOPE / DECISION-0131 §B7): TODAS as agregações são
// ESCOPADAS POR TENANT. Antes, as queries rodavam `pool.query` SEM filtro `tenant_id` → qualquer
// usuário autenticado lia agregados PLATAFORMA-WIDE (vazamento cross-tenant). Agora cada query
// filtra por `tenant_id` (server-side, vindo da rota via req.tenant.id). Não há agregado
// cross-tenant aqui — métricas platform-wide seriam endpoint institucional próprio (frente futura).
import { pool } from '@core/database/pool';

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
   * Calcula métricas do dia atual PARA O TENANT (server-side).
   */
  async getTodayMetrics(tenantId: string): Promise<DailyMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.getMetricsForDate(tenantId, today, tomorrow);
  }

  /**
   * Calcula métricas dos últimos N dias PARA O TENANT (server-side).
   */
  async getMetricsHistory(tenantId: string, days: number = 7): Promise<DailyMetrics[]> {
    const metrics: DailyMetrics[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      metrics.push(await this.getMetricsForDate(tenantId, date, nextDate));
    }
    return metrics;
  }

  private async getMetricsForDate(tenantId: string, start: Date, end: Date): Promise<DailyMetrics> {
    const operational = {
      uptime: 0,
      avgResponseTime: 0,
      errorRate: 0,
      webhookSuccessRate: await this.calculateWebhookSuccessRate(start, end),
    };

    const business = {
      activeOrganizers: await this.countActiveOrganizers(tenantId),
      totalEvents: await this.countEventsCreated(tenantId, start, end),
      activeSubscriptions: await this.countActiveSubscriptions(tenantId),
      totalRevenue: await this.calculateTodayRevenue(start, end),
      conversionRate: await this.calculateConversionRate(tenantId, start, end),
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

  private async calculateWebhookSuccessRate(_start: Date, _end: Date): Promise<number> {
    // placeholder (sem query) — preencher via monitoramento externo.
    return 100;
  }

  private async countActiveOrganizers(tenantId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT id) as count
         FROM event_organizers
        WHERE tenant_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'`,
      [tenantId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async countEventsCreated(tenantId: string, start: Date, end: Date): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
         FROM events
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3`,
      [tenantId, start, end]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async countActiveSubscriptions(tenantId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
         FROM organizer_subscriptions
        WHERE tenant_id = $1 AND status = 'active' AND ends_at > NOW()`,
      [tenantId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async calculateTodayRevenue(_start: Date, _end: Date): Promise<number> {
    // placeholder (sem query) — integrar com Stripe para valores reais.
    return 0;
  }

  private async calculateConversionRate(tenantId: string, start: Date, end: Date): Promise<number> {
    const viewsResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
         FROM event_metrics
        WHERE tenant_id = $1 AND metric_type = 'VIEW' AND created_at >= $2 AND created_at < $3`,
      [tenantId, start, end]
    );
    const conversionsResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
         FROM event_metrics
        WHERE tenant_id = $1 AND metric_type = 'CONVERSION' AND created_at >= $2 AND created_at < $3`,
      [tenantId, start, end]
    );
    const views = parseInt(viewsResult.rows[0]?.count || '0', 10);
    const conversions = parseInt(conversionsResult.rows[0]?.count || '0', 10);
    if (views === 0) return 0;
    return (conversions / views) * 100;
  }
}

export const dailyMetricsService = new DailyMetricsService();
