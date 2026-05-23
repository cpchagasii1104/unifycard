// src/core/events/event-metrics.service.ts
// Métricas básicas para eventos
// FASE 8: HARDENING

import { runQueryWithTenant } from '@core/database/pool';

export interface EventMetrics {
  events_created: number;
  events_published: number;
  events_paid: number;
  publish_failures_economy: number;
  checkouts_completed: number;
}

class EventMetricsService {
  /**
   * Incrementa contador de eventos criados
   */
  async incrementEventsCreated(tenantId: string): Promise<void> {
    // Por enquanto, apenas log (métricas podem ser implementadas com Prometheus no futuro)
    // Esta função existe para manter interface consistente
  }

  /**
   * Incrementa contador de eventos publicados
   */
  async incrementEventsPublished(tenantId: string): Promise<void> {
    // Por enquanto, apenas log
  }

  /**
   * Incrementa contador de eventos pagos
   */
  async incrementEventsPaid(tenantId: string): Promise<void> {
    // Por enquanto, apenas log
  }

  /**
   * Incrementa contador de falhas de publicação por economia
   */
  async incrementPublishFailuresEconomy(tenantId: string): Promise<void> {
    // Por enquanto, apenas log
  }

  /**
   * Incrementa contador de checkouts realizados
   */
  async incrementCheckoutsCompleted(tenantId: string): Promise<void> {
    // Por enquanto, apenas log
  }

  /**
   * Obtém métricas básicas (contadores simples)
   */
  async getMetrics(tenantId: string, timeWindowHours: number = 24): Promise<EventMetrics> {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const [created, published, paid, checkouts] = await Promise.all([
      runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM events
        WHERE tenant_id = $1 AND created_at >= $2
        `,
        [tenantId, since]
      ),
      runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM events
        WHERE tenant_id = $1 AND status = 'published' AND updated_at >= $2
        `,
        [tenantId, since]
      ),
      runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM events
        WHERE tenant_id = $1 
          AND status = 'published' 
          AND ticket_price_cents > 0
          AND updated_at >= $2
        `,
        [tenantId, since]
      ),
      runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::text as count
        FROM event_attendees
        WHERE tenant_id = $1 AND created_at >= $2
        `,
        [tenantId, since]
      ),
    ]);

    return {
      events_created: parseInt(created?.count || '0', 10),
      events_published: parseInt(published?.count || '0', 10),
      events_paid: parseInt(paid?.count || '0', 10),
      publish_failures_economy: 0, // TODO: Implementar contador de falhas
      checkouts_completed: parseInt(checkouts?.count || '0', 10),
    };
  }
}

export const eventMetricsService = new EventMetricsService();















