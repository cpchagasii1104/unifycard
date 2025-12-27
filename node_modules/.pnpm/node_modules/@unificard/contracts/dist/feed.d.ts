/**
 * @unificard/contracts - Feed
 *
 * Tipos de domínio para feed unificado (posts + eventos).
 * Fonte única de verdade para frontend e backend.
 */
/**
 * Tipo de item do feed.
 * Define a semântica do conteúdo no stream.
 */
export type FeedItemType = 'POST' | 'EVENT_STANDALONE' | 'EVENT_ANNOUNCEMENT' | 'EVENT_UPDATE' | 'EVENT_REMINDER';
/**
 * Item unificado do feed.
 * Pode ser post ou evento standalone.
 */
export type FeedItem = {
    type: 'POST' | 'EVENT_ANNOUNCEMENT' | 'EVENT_UPDATE' | 'EVENT_REMINDER';
    id: string;
    createdAt: string;
    post: {
        postId: string;
        content: string;
        type: string;
        createdAt: string;
        eventId?: string | null;
        event?: FeedEvent | null;
        globalUserId: string;
        media: any[];
        metadata: Record<string, any>;
    };
} | {
    type: 'EVENT_STANDALONE';
    id: string;
    createdAt: string;
    event: FeedEvent;
};
/**
 * Dados de evento no feed.
 * Representação simplificada para exibição.
 */
export interface FeedEvent {
    id: string;
    title: string;
    eventType: string;
    startTime: string;
    endTime: string | null;
    cityId: string | null;
    ticketPrice: number | null;
    acceptsConsumption: boolean;
    status: string;
    description?: string | null;
    maxCapacity?: number | null;
    currentOccupancy?: number;
    timezone?: string;
}
/**
 * Resposta do feed unificado.
 */
export interface FeedResponse {
    items: FeedItem[];
    total: number;
    posts?: Array<{
        postId: string;
        content: string;
        type: string;
        createdAt: string;
        eventId?: string | null;
        event?: FeedEvent | null;
        globalUserId: string;
        media: any[];
        metadata: Record<string, any>;
    }>;
}
//# sourceMappingURL=feed.d.ts.map