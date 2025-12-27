import type { PostRow } from './social.types';
export declare class SocialRepository {
    /**
     * Busca post por ID
     */
    findById(tenantId: string, postId: string): Promise<PostRow | null>;
    /**
     * Cria um novo post
     */
    create(data: {
        tenantId: string;
        globalUserId: string;
        content: string;
        type?: string | null;
        visibility?: string | null;
        media: any;
        intent: string | null;
        confidence: number | null;
        categories: string[];
        suggestedActions: any;
        metadata: any;
        eventId?: string | null;
    }): Promise<PostRow>;
    /**
     * Busca feed de posts
     */
    findFeed(tenantId: string, options?: {
        limit?: number;
        offset?: number;
        categoryId?: string;
        intent?: string;
        userId?: string;
        groupId?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        rows: PostRow[];
        total: number;
    }>;
    /**
     * Atualiza metadata de um post
     */
    updateMetadata(tenantId: string, postId: string, metadata: any): Promise<void>;
}
//# sourceMappingURL=social.repository.d.ts.map