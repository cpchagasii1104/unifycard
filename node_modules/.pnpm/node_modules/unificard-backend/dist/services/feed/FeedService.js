"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedService = void 0;
// src/services/feed/FeedService.ts
// 🔴 CRÍTICO: Feed é READ-ONLY, nunca executa lógica financeira
const db_1 = require("@core/db");
const feed_priority_service_1 = require("./feed-priority.service");
const event_feed_adapter_1 = require("./event-feed-adapter");
class FeedService {
    /**
     * Cache para verificação de coluna event_id (evita múltiplas consultas)
     */
    _hasEventIdColumn = null;
    /**
     * Cache para verificação de coluna visibility (evita múltiplas consultas)
     */
    _hasVisibilityColumn = null;
    /**
     * Verifica se a coluna posts.event_id existe no schema
     * DEFENSIVE: Permite que o feed funcione mesmo sem migration 070
     */
    async hasEventIdColumn() {
        if (this._hasEventIdColumn !== null) {
            return this._hasEventIdColumn;
        }
        try {
            const { runSystemQuery } = await Promise.resolve().then(() => __importStar(require('@core/db')));
            const result = await runSystemQuery({
                text: `
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'posts' 
              AND column_name = 'event_id'
          ) as exists
        `,
            });
            this._hasEventIdColumn = result[0]?.exists || false;
            return this._hasEventIdColumn;
        }
        catch (error) {
            // Em caso de erro, assumir que coluna não existe (degradação graciosa)
            console.warn('Erro ao verificar coluna posts.event_id, assumindo que não existe:', error);
            this._hasEventIdColumn = false;
            return false;
        }
    }
    /**
     * Verifica se a coluna posts.visibility existe no schema
     * DEFENSIVE: Permite que o feed funcione mesmo sem migration 070
     */
    async hasVisibilityColumn() {
        if (this._hasVisibilityColumn !== null) {
            return this._hasVisibilityColumn;
        }
        try {
            const { runSystemQuery } = await Promise.resolve().then(() => __importStar(require('@core/db')));
            const result = await runSystemQuery({
                text: `
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'posts' 
              AND column_name = 'visibility'
          ) as exists
        `,
            });
            this._hasVisibilityColumn = result[0]?.exists || false;
            return this._hasVisibilityColumn;
        }
        catch (error) {
            // Em caso de erro, assumir que coluna não existe (degradação graciosa)
            console.warn('Erro ao verificar coluna posts.visibility, assumindo que não existe:', error);
            this._hasVisibilityColumn = false;
            return false;
        }
    }
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
        // DEFENSIVE: Verificar se colunas existem antes de usar
        const hasEventIdColumn = await this.hasEventIdColumn();
        const hasVisibilityColumn = await this.hasVisibilityColumn();
        // Query 1: Posts com eventos vinculados (se coluna existir)
        // CONTRATO v1: Usa campos canônicos (datetime_start, datetime_end, status, ticket_price_cents)
        let postsQuery = `
      SELECT 
        p.post_id,
        p.content,
        p.type,
        p.created_at,
        p.global_user_id,
        p.media
    `;
        // Adicionar campos de evento apenas se coluna existir
        if (hasEventIdColumn) {
            postsQuery += `,
        e.id as event_id,
        e.title as event_title,
        e.event_type,
        e.datetime_start as event_start_time,
        e.datetime_end as event_end_time,
        e.city_id as event_city_id,
        e.ticket_price_cents as event_ticket_price,
        e.status as event_status
      FROM posts p
      LEFT JOIN events e ON e.id = p.event_id
      `;
            // Filtro de visibility apenas se coluna existir
            if (hasVisibilityColumn) {
                postsQuery += `WHERE p.visibility = 'PUBLIC'`;
            }
            else {
                postsQuery += `WHERE 1=1`; // Sem filtro de visibility
            }
            // 🔴 FILTRO DE GRUPOS: Excluir posts de grupos privados/secretos do feed global
            // Posts de grupos privados/secretos não devem aparecer no feed global
            postsQuery += `
        AND (
          p.metadata->>'groupId' IS NULL
          OR EXISTS (
            SELECT 1 FROM groups g
            WHERE g.group_id::text = p.metadata->>'groupId'
              AND g.tenant_id = p.tenant_id
              AND g.visibility = 'public'
          )
        )
      `;
            postsQuery += `
        AND (
          p.event_id IS NULL
          OR (e.status = 'published' AND e.visibility IN ('public', 'unlisted'))
        )
      `;
        }
        else {
            // Sem coluna event_id: apenas posts, sem join com events
            postsQuery += `
      FROM posts p
      `;
            // Filtro de visibility apenas se coluna existir
            if (hasVisibilityColumn) {
                postsQuery += `WHERE p.visibility = 'PUBLIC'`;
            }
            else {
                postsQuery += `WHERE 1=1`; // Sem filtro de visibility
            }
            // 🔴 FILTRO DE GRUPOS: Excluir posts de grupos privados/secretos do feed global
            // Posts de grupos privados/secretos não devem aparecer no feed global
            postsQuery += `
        AND (
          p.metadata->>'groupId' IS NULL
          OR EXISTS (
            SELECT 1 FROM groups g
            WHERE g.group_id::text = p.metadata->>'groupId'
              AND g.tenant_id = p.tenant_id
              AND g.visibility = 'public'
          )
        )
      `;
        }
        const postsValues = [];
        let postsParamIndex = 1;
        if (type) {
            postsQuery += ` AND p.type = $${postsParamIndex}`;
            postsValues.push(type);
            postsParamIndex++;
        }
        if (cityId) {
            if (hasEventIdColumn) {
                postsQuery += ` AND (e.city_id = $${postsParamIndex} OR p.event_id IS NULL)`;
            }
            // Se não tem coluna event_id, não filtra por cidade de evento (apenas posts)
            postsValues.push(cityId);
            postsParamIndex++;
        }
        // Query 2: Eventos standalone (sem post vinculado) - CONTRATO v1
        // Apenas eventos com status='published' aparecem no feed
        // Visibility é respeitada (public, unlisted aparecem; private não aparece)
        // CONTRATO v1: Usa campos canônicos (datetime_start, datetime_end, status, visibility)
        let eventsQuery = `
      SELECT DISTINCT
        e.id,
        e.title,
        e.description,
        e.event_type,
        e.event_subtype,
        e.datetime_start,
        e.datetime_end,
        e.status,
        e.visibility,
        e.ticket_price_cents,
        e.max_attendees,
        e.city_id,
        e.state_id,
        e.country_id,
        e.created_at
      FROM events e
    `;
        // Só fazer LEFT JOIN com posts se coluna event_id existir
        if (hasEventIdColumn) {
            eventsQuery += ` LEFT JOIN posts p ON p.event_id = e.id
      WHERE e.status = 'published'
        AND e.visibility IN ('public', 'unlisted')
        AND p.post_id IS NULL
        AND e.tenant_id = $1
      `;
        }
        else {
            // Sem coluna event_id: mostrar todos os eventos publicados (não há como verificar se tem post)
            eventsQuery += `
      WHERE e.status = 'published'
        AND e.visibility IN ('public', 'unlisted')
        AND e.tenant_id = $1
      `;
        }
        const eventsValues = [tenantId];
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
            // DEFENSIVE: Verificar se campos de evento existem antes de usar
            const eventId = hasEventIdColumn ? row.event_id : null;
            const hasEventData = hasEventIdColumn && eventId && row.event_title;
            return {
                type: feedItemType,
                id: row.post_id,
                createdAt: row.created_at.toISOString(),
                post: {
                    postId: row.post_id,
                    content: row.content,
                    type: postType,
                    createdAt: row.created_at.toISOString(),
                    eventId: eventId || null,
                    event: hasEventData
                        ? {
                            id: eventId,
                            title: row.event_title || '',
                            eventType: row.event_type || '',
                            startTime: row.event_start_time.toISOString(),
                            endTime: row.event_end_time?.toISOString() || null,
                            cityId: row.event_city_id,
                            ticketPrice: row.event_ticket_price, // ticket_price_cents em centavos
                            acceptsConsumption: false, // TODO: Implementar quando houver campo
                            status: row.event_status || '',
                            description: null, // Não disponível na query atual
                            maxCapacity: null, // Não disponível na query atual
                            currentOccupancy: 0, // Não disponível na query atual
                            timezone: 'America/Sao_Paulo', // Default
                        }
                        : null,
                    globalUserId: row.global_user_id,
                    media: Array.isArray(row.media) ? row.media : [],
                    metadata: {},
                },
            };
        });
        // Transformar eventos standalone em FeedItem usando FeedAdapter
        // CONTRATO v1: Filtra por status='published' e visibility
        const eventItems = eventRows
            .filter((row) => (0, event_feed_adapter_1.shouldEventAppearInFeed)(row.status, row.visibility))
            .map((row) => (0, event_feed_adapter_1.adaptEventToFeedItem)(row));
        // Priorizar eventos baseado em event_type (CONTRATO v1) e métricas
        // CONTRATO v1: Score baseado em event_type
        // - cultural, professional, community = prioridade alta (50)
        // - gastronomic, spiritual, sports, social = média (30)
        // - private = não aparece (0)
        let sortedItems;
        const eventItemIds = eventItems.map((item) => item.id);
        if (eventItemIds.length > 0) {
            try {
                // Calcular scores baseados em event_type (CONTRATO v1)
                const eventItemsWithScores = eventItems.map((item) => {
                    if (item.type === 'EVENT_STANDALONE') {
                        const eventTypeScore = (0, event_feed_adapter_1.calculateEventFeedScore)(item.event.eventType);
                        return { item, score: eventTypeScore };
                    }
                    return { item, score: 0 };
                });
                // Tentar priorizar por métricas também (se disponível)
                let prioritizedEventIds;
                try {
                    prioritizedEventIds = await feed_priority_service_1.feedPriorityService.prioritizeEvents(tenantId, eventItemIds);
                }
                catch (error) {
                    // Se métricas falharem, usar apenas score de event_type
                    console.warn('Erro ao priorizar eventos por métricas, usando apenas event_type:', error);
                    prioritizedEventIds = eventItemIds;
                }
                // Combinar scores: event_type (base) + métricas (bonus)
                const eventItemsMap = new Map(eventItemsWithScores.map((entry) => [entry.item.id, entry]));
                const prioritizedEventItems = prioritizedEventIds
                    .map((id, index) => {
                    const entry = eventItemsMap.get(id);
                    if (!entry)
                        return null;
                    // Adicionar bonus baseado na posição na priorização por métricas
                    const metricsBonus = (prioritizedEventIds.length - index) * 0.1;
                    return { item: entry.item, score: entry.score + metricsBonus };
                })
                    .filter((entry) => entry !== null);
                // Ordenar eventos por score combinado (maior primeiro)
                prioritizedEventItems.sort((a, b) => b.score - a.score);
                // Ordenar posts por data (mais recente primeiro)
                const sortedPosts = postItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                // Intercalar: eventos priorizados primeiro, depois posts
                sortedItems = [
                    ...prioritizedEventItems.map((entry) => entry.item),
                    ...sortedPosts,
                ];
            }
            catch (error) {
                // Se priorização falhar completamente, usar ordenação padrão (não quebra o feed)
                console.warn('Erro ao priorizar eventos, usando ordenação padrão:', error);
                sortedItems = [...postItems, ...eventItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
        }
        else {
            // Ordenação padrão (apenas posts)
            sortedItems = postItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        // Aplicar paginação
        const paginatedItems = sortedItems.slice(offset, offset + limit);
        const total = sortedItems.length;
        // Extrair posts para compatibilidade reversa
        const posts = postItems
            .filter((item) => item.type !== 'EVENT_STANDALONE' && 'post' in item)
            .map(item => item.post);
        return { items: paginatedItems, total, posts };
    }
}
exports.FeedService = FeedService;
