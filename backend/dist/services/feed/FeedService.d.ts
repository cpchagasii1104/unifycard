import { FeedItem, FeedPost, FeedItemType } from '@unificard/contracts';
export type PostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'EVENT_ANNOUNCEMENT' | 'EVENT_UPDATE' | 'EVENT_REMINDER';
export type { FeedItem, FeedPost, FeedItemType };
export interface FeedVisibilityRules {
    eventStatus?: 'PUBLISHED' | 'ONGOING';
    cityMatch?: boolean;
    dateInRange?: boolean;
}
export declare class FeedService {
    /**
     * Busca feed de posts (READ-ONLY)
     * 🔴 CRÍTICO: Nenhuma mutation, nenhuma transação, nenhum lock
     */
    /**
     * Busca feed unificado (posts + eventos standalone)
     * 🔴 CRÍTICO: READ-ONLY, nenhuma mutation
     */
    getFeed(params: {
        tenantId: string;
        limit?: number;
        offset?: number;
        type?: PostType;
        cityId?: string;
    }): Promise<{
        items: FeedItem[];
        total: number;
        posts?: FeedPost[];
    }>;
}
//# sourceMappingURL=FeedService.d.ts.map