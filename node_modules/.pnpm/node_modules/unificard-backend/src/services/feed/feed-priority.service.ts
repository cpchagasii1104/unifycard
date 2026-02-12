// src/services/feed/feed-priority.service.ts
// Service para priorizar eventos no feed baseado em métricas
import { runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';
import { eventStateService } from '../../modules/events/event-state.service';
import { organizerPlansService } from '../../modules/events/organizers/organizer-plans.service';

export interface EventPriorityScore {
  eventId: string;
  score: number;
  factors: {
    conversionRate: number;
    ctaClickRate: number;
    totalViews: number;
    state: 'PRE' | 'DURING' | 'POST';
    isSoon?: boolean;
  };
}

export class FeedPriorityService {
  /**
   * Calcula score de prioridade para eventos baseado em métricas
   */
  async calculateEventScores(
    tenantId: string,
    eventIds: string[]
  ): Promise<Map<string, EventPriorityScore>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    // Buscar métricas agregadas por evento
    const metricsRows = await runQueriesWithTenant<{
      event_id: string;
      metric_type: string;
      count: string;
    }>(
      tenantId,
      `
      SELECT event_id, metric_type, COUNT(*) as count
      FROM event_metrics
      WHERE event_id = ANY($1::uuid[])
      GROUP BY event_id, metric_type
      `,
      [eventIds]
    );

    // Buscar informações dos eventos (para calcular estado e plano do organizador)
    const eventsRows = await runQueriesWithTenant<{
      id: string;
      starts_at: Date;
      ends_at: Date;
      status: string;
      organizer_id: string | null;
    }>(
      tenantId,
      `
      SELECT id, starts_at, ends_at, status, organizer_id
      FROM events
      WHERE id = ANY($1::uuid[])
      `,
      [eventIds]
    );

    // Buscar planos dos organizadores (se houver)
    const organizerIds = eventsRows
      .map((e) => e.organizer_id)
      .filter((id): id is string => id !== null);
    
    const organizerPlans = new Map<string, string>();
    if (organizerIds.length > 0) {
      const organizerRows = await runQueriesWithTenant<{
        id: string;
        plan: string;
        plan_expires_at: Date | null;
      }>(
        tenantId,
        `
        SELECT id, plan, plan_expires_at
        FROM event_organizers
        WHERE id = ANY($1::uuid[])
        `,
        [organizerIds]
      );

      organizerRows.forEach((row) => {
        // Verificar se plano não expirou
        if (!row.plan_expires_at || row.plan_expires_at > new Date()) {
          organizerPlans.set(row.id, row.plan);
        }
      });
    }

    // Agregar métricas por evento
    const metricsByEvent = new Map<string, { views: number; clicks: number; conversions: number }>();
    
    metricsRows.forEach((row) => {
      if (!metricsByEvent.has(row.event_id)) {
        metricsByEvent.set(row.event_id, { views: 0, clicks: 0, conversions: 0 });
      }
      const metrics = metricsByEvent.get(row.event_id)!;
      
      if (row.metric_type === 'VIEW') {
        metrics.views = parseInt(row.count, 10);
      } else if (row.metric_type === 'CTA_CLICK') {
        metrics.clicks = parseInt(row.count, 10);
      } else if (row.metric_type === 'CONVERSION') {
        metrics.conversions = parseInt(row.count, 10);
      }
    });

    // Calcular scores
    const scores = new Map<string, EventPriorityScore>();

    eventsRows.forEach((event) => {
      const metrics = metricsByEvent.get(event.id) || { views: 0, clicks: 0, conversions: 0 };
      
      // Calcular taxas
      const conversionRate = metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0;
      const ctaClickRate = metrics.views > 0 ? metrics.clicks / metrics.views : 0;

      // Determinar estado
      const stateInfo = eventStateService.getEventState({
        startTime: event.starts_at,
        endTime: event.ends_at,
        status: event.status,
      });

      // Calcular score base (pesos configuráveis)
      // Fórmula: (conversionRate * 0.4) + (ctaClickRate * 0.3) + (views * 0.001) + (state bonus)
      let score = 
        conversionRate * 0.4 +           // 40% - taxa de conversão
        ctaClickRate * 0.3 +             // 30% - taxa de clique
        Math.min(metrics.views * 0.001, 1) * 0.2; // 20% - volume (limitado a 1)

      // Bonus por estado
      if (stateInfo.state === 'PRE' && stateInfo.isSoon) {
        score += 0.1; // +10% para eventos que começam em breve
      } else if (stateInfo.state === 'DURING') {
        score += 0.15; // +15% para eventos em andamento
      }

      // Multiplicador por plano do organizador
      if (event.organizer_id) {
        const organizerPlan = organizerPlans.get(event.organizer_id);
        if (organizerPlan) {
          const multiplier = organizerPlansService.getFeedPriorityMultiplier(
            organizerPlan as 'free' | 'basic' | 'pro' | 'enterprise'
          );
          score *= multiplier;
        }
      }

      scores.set(event.id, {
        eventId: event.id,
        score: Math.round(score * 1000) / 1000, // 3 casas decimais
        factors: {
          conversionRate: Math.round(conversionRate * 10000) / 100,
          ctaClickRate: Math.round(ctaClickRate * 10000) / 100,
          totalViews: metrics.views,
          state: stateInfo.state,
          isSoon: stateInfo.isSoon,
        },
      });
    });

    return scores;
  }

  /**
   * Ordena eventos por score de prioridade
   */
  async prioritizeEvents(
    tenantId: string,
    eventIds: string[]
  ): Promise<string[]> {
    const scores = await this.calculateEventScores(tenantId, eventIds);
    
    // Ordenar por score (maior primeiro)
    return eventIds
      .map((id) => ({ id, score: scores.get(id)?.score || 0 }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.id);
  }
}

export const feedPriorityService = new FeedPriorityService();


