// src/modules/events/event-organizer-metrics.service.ts
// Service para métricas de eventos para organizadores (versão simplificada)
import { runQueryWithTenant } from '@core/database/pool';
import { eventMetricsDashboardService } from './event-metrics-dashboard.service';

export interface OrganizerEventMetrics {
  eventId: string;
  eventTitle: string;
  eventState: 'PRE' | 'DURING' | 'POST';
  // Métricas principais (sem detalhes técnicos)
  reach: {
    totalViews: number;
    viewsFromFeed: number;
    viewsFromPage: number;
    viewsDirect: number;
  };
  engagement: {
    totalCTAClicks: number;
    ctaClickRate: number; // %
  };
  conversion: {
    totalConversions: number;
    conversionRate: number; // %
    revenue?: number; // Se disponível (futuro)
  };
  performance: {
    bestCTAType?: 'ticket' | 'consumption' | 'parking';
    bestState?: 'PRE' | 'DURING' | 'POST';
    improvementTip?: string;
  };
}

export class EventOrganizerMetricsService {
  /**
   * Verifica se usuário tem permissão para ver métricas do evento
   */
  async canViewMetrics(
    tenantId: string,
    eventId: string,
    globalUserId: string
  ): Promise<boolean> {
    // Verificar se é criador do evento
    const eventRow = await runQueryWithTenant<{
      created_by_global_user_id: string;
      organizer_id: string | null;
    }>(
      tenantId,
      `
      SELECT created_by_global_user_id, organizer_id
      FROM events
      WHERE id = $1
      `,
      [eventId]
    );

    if (!eventRow) {
      return false;
    }

    const event = eventRow;

    // Se é criador, tem permissão
    if (event.created_by_global_user_id === globalUserId) {
      return true;
    }

    // Se evento está vinculado a organizador, verificar se usuário é membro
    if (event.organizer_id) {
      const memberRow = await runQueryWithTenant<{
        role: string;
      }>(
        tenantId,
        `
        SELECT role
        FROM event_organizer_members
        WHERE organizer_id = $1 AND global_user_id = $2
        LIMIT 1
        `,
        [event.organizer_id, globalUserId]
      );

      if (memberRow) {
        // Qualquer membro pode ver métricas (owner, admin, editor, viewer)
        return true;
      }

      // Verificar se é owner do organizador
      const organizerRow = await runQueryWithTenant<{
        owner_global_user_id: string;
      }>(
        tenantId,
        `
        SELECT owner_global_user_id
        FROM event_organizers
        WHERE id = $1
        `,
        [event.organizer_id]
      );

      if (organizerRow && organizerRow.owner_global_user_id === globalUserId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Busca métricas do evento para organizador (versão simplificada)
   */
  async getOrganizerMetrics(
    tenantId: string,
    eventId: string,
    globalUserId: string
  ): Promise<OrganizerEventMetrics | null> {
    // Verificar permissão
    const hasPermission = await this.canViewMetrics(tenantId, eventId, globalUserId);
    if (!hasPermission) {
      return null;
    }

    // Buscar dashboard completo
    const dashboard = await eventMetricsDashboardService.getEventDashboard(tenantId, eventId);
    if (!dashboard) {
      return null;
    }

    // Transformar em versão para organizador (sem detalhes técnicos)
    const bestCTAType = Object.entries(dashboard.byCTAType)
      .map(([type, data]) => ({
        type: type as 'ticket' | 'consumption' | 'parking',
        rate: data.clicks > 0 ? data.conversions / data.clicks : 0,
      }))
      .sort((a, b) => b.rate - a.rate)[0]?.type;

    const bestState = Object.entries(dashboard.byState)
      .map(([state, data]) => ({
        state: state as 'PRE' | 'DURING' | 'POST',
        rate: data.clicks > 0 ? data.conversions / data.clicks : 0,
      }))
      .sort((a, b) => b.rate - a.rate)[0]?.state;

    // Gerar dica de melhoria
    let improvementTip: string | undefined;
    if (dashboard.metrics.conversionRate < 10) {
      improvementTip = 'Taxa de conversão abaixo da média. Considere ajustar o CTA ou o preço.';
    } else if (dashboard.metrics.ctaClickRate < 5) {
      improvementTip = 'Poucos cliques no CTA. Considere destacar melhor o botão ou ajustar a copy.';
    } else if (dashboard.metrics.conversionRate > 30) {
      improvementTip = 'Excelente taxa de conversão! Continue assim.';
    }

    return {
      eventId: dashboard.eventId,
      eventTitle: dashboard.eventTitle,
      eventState: dashboard.eventState,
      reach: {
        totalViews: dashboard.metrics.totalViews,
        viewsFromFeed: dashboard.bySource.feed || 0,
        viewsFromPage: dashboard.bySource.event_page || 0,
        viewsDirect: dashboard.bySource.direct || 0,
      },
      engagement: {
        totalCTAClicks: dashboard.metrics.totalCTAClicks,
        ctaClickRate: dashboard.metrics.ctaClickRate,
      },
      conversion: {
        totalConversions: dashboard.metrics.totalConversions,
        conversionRate: dashboard.metrics.conversionRate,
      },
      performance: {
        bestCTAType,
        bestState,
        improvementTip,
      },
    };
  }
}

export const eventOrganizerMetricsService = new EventOrganizerMetricsService();

