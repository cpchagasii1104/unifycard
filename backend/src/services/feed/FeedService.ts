// src/services/feed/FeedService.ts
// 🔴 CRÍTICO: Feed é READ-ONLY, nunca executa lógica financeira
import { runQueriesWithTenant } from '@core/db';
import { FeedItem, FeedItemType, FeedResponse } from '@unificard/contracts';
import { feedPriorityService } from './feed-priority.service';

// Re-export para compatibilidade reversa
export type PostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'EVENT_ANNOUNCEMENT' | 'EVENT_UPDATE' | 'EVENT_REMINDER';
export type { FeedItem, FeedItemType, FeedResponse };

export interface FeedVisibilityRules {
  eventStatus?: 'PUBLISHED' | 'ONGOING'; // ❌ DRAFT / CANCELLED não aparecem
  cityMatch?: boolean; // prioridade local
  dateInRange?: boolean; // próximos X dias
}

interface FeedPostRow {
  post_id: string;
  content: string;
  type: string;
  created_at: Date;
  event_id: string | null;
  global_user_id: string;
  media: any;
  metadata: any;
  // Event fields
  event_title: string | null;
  event_type: string | null;
  event_start_time: Date | null;
  event_end_time: Date | null;
  event_city_id: string | null;
  event_ticket_price: number | null;
  event_accepts_consumption: boolean | null;
  event_status: string | null;
}

export class FeedService {
  /**
   * Busca feed de posts (READ-ONLY)
   * 🔴 CRÍTICO: Nenhuma mutation, nenhuma transação, nenhum lock
   */
  /**
   * Busca feed unificado (posts + eventos standalone)
   * 🔴 CRÍTICO: READ-ONLY, nenhuma mutation
   */
  async getFeed(params: {
    tenantId: string;
    limit?: number;
    offset?: number;
    type?: PostType;
    cityId?: string;
  }): Promise<FeedResponse> {
    const { tenantId, limit = 50, offset = 0, type, cityId } = params;

    // Query 1: Posts com eventos vinculados
    let postsQuery = `
      SELECT 
        p.post_id,
        p.content,
        p.type,
        p.created_at,
        p.global_user_id,
        p.media,
        p.metadata,
        e.id as event_id,
        e.title as event_title,
        e.event_type,
        e.start_time as event_start_time,
        e.end_time as event_end_time,
        e.city_id as event_city_id,
        e.ticket_price as event_ticket_price,
        e.accepts_consumption as event_accepts_consumption,
        e.status as event_status
      FROM posts p
      LEFT JOIN events e ON e.id = p.event_id
      WHERE p.visibility = 'PUBLIC'
        AND (
          p.event_id IS NULL
          OR (e.status IN ('PUBLISHED', 'ONGOING'))
        )
    `;

    const postsValues: any[] = [];
    let postsParamIndex = 1;

    if (type) {
      postsQuery += ` AND p.type = $${postsParamIndex}`;
      postsValues.push(type);
      postsParamIndex++;
    }

    if (cityId) {
      postsQuery += ` AND (e.city_id = $${postsParamIndex} OR p.event_id IS NULL)`;
      postsValues.push(cityId);
      postsParamIndex++;
    }

    // Query 2: Eventos standalone (sem post vinculado) - Multi-atores
    // Eventos aparecem via event_actor, garantindo que apareçam nos feeds de todos os actors vinculados
    // DISTINCT garante que não haja duplicação mesmo se um evento tiver múltiplos actors
    let eventsQuery = `
      SELECT DISTINCT
        e.id,
        e.title,
        e.description,
        e.event_type,
        e.start_time,
        e.end_time,
        e.datetime_start,
        e.datetime_end,
        e.location_name,
        e.capacity,
        e.city_id,
        e.ticket_price,
        e.accepts_consumption,
        e.status,
        e.max_capacity,
        e.current_occupancy,
        e.timezone,
        e.created_at
      FROM events e
      INNER JOIN event_actor ea ON ea.event_id = e.id
      LEFT JOIN posts p ON p.event_id = e.id
      WHERE e.status IN ('published', 'ongoing')
        AND ea.status = 'accepted'
        AND p.post_id IS NULL
        AND e.tenant_id = $1
    `;

    const eventsValues: any[] = [tenantId];
    let eventsParamIndex = 2;

    if (cityId) {
      eventsQuery += ` AND e.city_id = $${eventsParamIndex}`;
      eventsValues.push(cityId);
      eventsParamIndex++;
    }

    // Ordenar por data de início (mais próximos primeiro)
    eventsQuery += ` ORDER BY e.datetime_start ASC, e.created_at DESC`;

    // Executar queries em paralelo
    const [postRows, eventRows] = await Promise.all([
      runQueriesWithTenant<FeedPostRow>(tenantId, {
        text: postsQuery,
        values: postsValues,
      }),
      runQueriesWithTenant<any>(tenantId, {
        text: eventsQuery,
        values: eventsValues,
      }),
    ]);

    // Transformar posts em FeedItem (formato do contrato)
    const postItems: FeedItem[] = postRows.map((row) => {
      const postType = row.type as PostType;
      const feedItemType: FeedItemType = 
        postType === 'EVENT_ANNOUNCEMENT' || postType === 'EVENT_UPDATE' || postType === 'EVENT_REMINDER'
          ? postType
          : 'POST';
      
      return {
        type: feedItemType,
        id: row.post_id,
        createdAt: row.created_at.toISOString(),
        post: {
          postId: row.post_id,
          content: row.content,
          type: postType,
          createdAt: row.created_at.toISOString(),
          eventId: row.event_id,
          event: row.event_id
            ? {
                id: row.event_id,
                title: row.event_title || '',
                eventType: row.event_type || '',
                startTime: row.event_start_time!.toISOString(),
                endTime: row.event_end_time?.toISOString() || null,
                cityId: row.event_city_id,
                ticketPrice: row.event_ticket_price,
                acceptsConsumption: row.event_accepts_consumption || false,
                status: row.event_status || '',
                description: null, // Não disponível na query atual
                maxCapacity: null, // Não disponível na query atual
                currentOccupancy: 0, // Não disponível na query atual
                timezone: 'America/Sao_Paulo', // Default
              }
            : null,
          globalUserId: row.global_user_id,
          media: Array.isArray(row.media) ? row.media : [],
          metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
        },
      };
    });

    // Transformar eventos standalone em FeedItem (formato do contrato)
    const eventItems: FeedItem[] = eventRows.map((row) => ({
      type: 'EVENT_STANDALONE' as const,
      id: row.id,
      createdAt: row.created_at.toISOString(),
      event: {
        id: row.id,
        title: row.title,
        eventType: row.event_type,
        startTime: row.start_time.toISOString(),
        endTime: row.end_time?.toISOString() || null,
        cityId: row.city_id,
        ticketPrice: row.ticket_price,
        acceptsConsumption: row.accepts_consumption || false,
        status: row.status,
        description: row.description,
        maxCapacity: row.max_capacity,
        currentOccupancy: row.current_occupancy || 0,
        timezone: row.timezone,
      },
    }));

    // Priorizar eventos baseado em métricas (se houver eventos)
    let sortedItems: FeedItem[];
    
    const eventItemIds = eventItems.map((item) => item.id);
    if (eventItemIds.length > 0) {
      try {
        const prioritizedEventIds = await feedPriorityService.prioritizeEvents(
          tenantId,
          eventItemIds
        );

        // Reordenar eventos por prioridade, mantendo posts por data
        const eventItemsMap = new Map(eventItems.map((item) => [item.id, item]));
        const prioritizedEventItems = prioritizedEventIds
          .map((id) => eventItemsMap.get(id))
          .filter((item): item is FeedItem => item !== undefined);

        // Ordenar: eventos priorizados primeiro, depois posts por data
        sortedItems = [
          ...prioritizedEventItems,
          ...postItems.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        ];
      } catch (error) {
        // Se priorização falhar, usar ordenação padrão (não quebra o feed)
        console.warn('Erro ao priorizar eventos, usando ordenação padrão:', error);
        sortedItems = [...postItems, ...eventItems].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    } else {
      // Ordenação padrão (apenas posts)
      sortedItems = postItems.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Aplicar paginação
    const paginatedItems = sortedItems.slice(offset, offset + limit);
    const total = sortedItems.length;

    // Extrair posts para compatibilidade reversa
    const posts = postItems
      .filter((item): item is Extract<FeedItem, { type: 'POST' | 'EVENT_ANNOUNCEMENT' | 'EVENT_UPDATE' | 'EVENT_REMINDER' }> => 
        item.type !== 'EVENT_STANDALONE' && 'post' in item
      )
      .map(item => item.post!);

    return { items: paginatedItems, total, posts };
  }
}




