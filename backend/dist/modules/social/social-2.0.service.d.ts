export interface PostWithActor {
    post_id: string;
    tenant_id: string;
    actor_id: string | null;
    global_user_id: string;
    content: string;
    media: any[];
    intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
    intent_metadata?: Record<string, any>;
    targeting?: {
        demographics?: {
            age_range?: [number, number];
            gender?: ('male' | 'female' | 'other')[];
        };
        lifestyle?: {
            drinks?: boolean;
            smokes?: boolean;
        };
        mobility?: {
            has_car?: boolean;
            uses_bike?: boolean;
            uses_skate?: boolean;
        };
        interests?: string[];
        professions?: string[];
        locations?: {
            radius_km?: number;
            city_id?: string;
        };
    };
    created_at: string;
    updated_at: string;
    actor: {
        actor_id: string;
        actor_type: string;
        display_name: string;
        avatar_url: string | null;
        cover_url?: string | null;
    };
    reactions_count: number;
    comments_count: number;
    user_reaction: string | null;
    relevance_score?: number;
    cta?: {
        cta_id: string;
        cta_type: 'booking' | 'service' | 'payment';
        target_actor_id: string | null;
        target_group_id: string | null;
        price: number | null;
        currency: string;
    };
    social_impact?: {
        group_name: string | null;
        total_impact_cents: number;
    };
    vote_results?: {
        options: Array<{
            index: number;
            text: string;
            count: number;
            percentage: number;
        }>;
        total_votes: number;
        closes_at?: string;
    };
}
export interface FeedResponse {
    posts: PostWithActor[];
    next_cursor: string | null;
    has_more: boolean;
}
export interface ReactionResponse {
    reaction_id: string;
    reaction_type: string;
    created_at: string;
    is_new: boolean;
}
export interface CommentResponse {
    comment_id: string;
    post_id: string;
    global_user_id: string;
    content: string;
    parent_comment_id: string | null;
    created_at: string;
    actor: {
        actor_id: string;
        display_name: string;
        avatar_url: string | null;
    };
}
export declare class Social2Service {
    /**
     * Busca feed com cursor pagination (prioriza posts de actors seguidos)
     */
    getFeed(tenantId: string, globalUserId: string, cursor: string | undefined, limit: number): Promise<FeedResponse>;
    /**
     * Cria um novo post (com CTA opcional)
     */
    createPost(tenantId: string, userId: string, globalUserId: string, content: string, actorId: string | undefined, mediaIds: string[], intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event', intentMetadata?: Record<string, any>, targeting?: {
        demographics?: {
            age_range?: [number, number];
            gender?: ('male' | 'female' | 'other')[];
        };
        lifestyle?: {
            drinks?: boolean;
            smokes?: boolean;
        };
        mobility?: {
            has_car?: boolean;
            uses_bike?: boolean;
            uses_skate?: boolean;
        };
        interests?: string[];
        professions?: string[];
        locations?: {
            radius_km?: number;
            city_id?: string;
        };
    }, cta?: {
        type: 'booking' | 'service' | 'payment';
        target_actor_id?: string;
        target_group_id?: string;
        price?: number;
        currency?: string;
        metadata?: Record<string, any>;
    }): Promise<PostWithActor>;
    /**
     * Adiciona ou atualiza reação
     */
    toggleReaction(tenantId: string, postId: string, globalUserId: string, reactionType: string): Promise<ReactionResponse>;
    /**
     * Cria comentário
     */
    createComment(tenantId: string, postId: string, globalUserId: string, content: string, parentCommentId: string | undefined): Promise<CommentResponse>;
    /**
     * Busca posts de um actor
     */
    getActorPosts(tenantId: string, actorId: string, limit: number): Promise<PostWithActor[]>;
    /**
     * Segue um actor
     */
    followActor(tenantId: string, followerActorId: string, targetActorId: string): Promise<{
        success: boolean;
        is_following: boolean;
    }>;
    /**
     * Deixa de seguir um actor
     */
    unfollowActor(tenantId: string, followerActorId: string, targetActorId: string): Promise<{
        success: boolean;
        is_following: boolean;
    }>;
    /**
     * Verifica se está seguindo
     */
    isFollowing(tenantId: string, followerActorId: string, targetActorId: string): Promise<boolean>;
    /**
     * Busca contadores de um actor
     */
    getActorCounts(tenantId: string, actorId: string): Promise<{
        followers_count: number;
        posts_count: number;
    }>;
    /**
     * Busca actor de um usuário (helper para outras rotas)
     */
    getUserActor(tenantId: string, globalUserId: string): Promise<{
        actor_id: string;
    } | null>;
}
export declare const social2Service: Social2Service;
//# sourceMappingURL=social-2.0.service.d.ts.map