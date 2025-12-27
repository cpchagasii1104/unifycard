"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedService = void 0;
// src/services/feed/FeedService.ts
// 🔴 CRÍTICO: Feed é READ-ONLY, nunca executa lógica financeira
const db_1 = require("@core/db");
class FeedService {
    /**
     * Busca feed de posts (READ-ONLY)
     * 🔴 CRÍTICO: Nenhuma mutation, nenhuma transação, nenhum lock
     */
    /**
     * Busca feed unificado (posts + eventos standalone)
     * 🔴 CRÍTICO: READ-ONLY, nenhuma mutation
     */
    async getFeed(params) {
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
        const postsValues = [];
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
        // Query 2: Eventos standalone (sem post vinculado)
        let eventsQuery = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.event_type,
        e.start_time,
        e.end_time,
        e.city_id,
        e.ticket_price,
        e.accepts_consumption,
        e.status,
        e.max_capacity,
        e.current_occupancy,
        e.timezone,
        e.created_at
      FROM events e
      LEFT JOIN posts p ON p.event_id = e.id
      WHERE e.status IN ('PUBLISHED', 'ONGOING')
        AND p.post_id IS NULL
        AND e.tenant_id = $1
    `;
        const eventsValues = [tenantId];
        let eventsParamIndex = 2;
        if (cityId) {
            eventsQuery += ` AND e.city_id = $${eventsParamIndex}`;
            eventsValues.push(cityId);
            eventsParamIndex++;
        }
        // Executar queries em paralelo
        const [postRows, eventRows] = await Promise.all([
            (0, db_1.runQueriesWithTenant)(tenantId, {
                text: postsQuery,
                values: postsValues,
            }),
            (0, db_1.runQueriesWithTenant)(tenantId, {
                text: eventsQuery,
                values: eventsValues,
            }),
        ]);
        // Transformar posts em FeedItem (formato do contrato)
        const postItems = postRows.map((row) => {
            const postType = row.type;
            const feedItemType = postType === 'EVENT_ANNOUNCEMENT' || postType === 'EVENT_UPDATE' || postType === 'EVENT_REMINDER'
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
                            startTime: row.event_start_time.toISOString(),
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
        const eventItems = eventRows.map((row) => ({
            type: 'EVENT_STANDALONE',
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
        // Unificar e ordenar por createdAt (mais recente primeiro)
        const allItems = [...postItems, ...eventItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Aplicar paginação
        const paginatedItems = allItems.slice(offset, offset + limit);
        const total = allItems.length;
        // Extrair posts para compatibilidade reversa
        const posts = postItems
            .filter((item) => item.type !== 'EVENT_STANDALONE' && 'post' in item)
            .map(item => item.post);
        return { items: paginatedItems, total, posts };
    }
}
exports.FeedService = FeedService;
//# sourceMappingURL=FeedService.js.map