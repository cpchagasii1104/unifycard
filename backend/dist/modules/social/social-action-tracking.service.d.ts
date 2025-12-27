import type { SuggestedAction as PostAction } from './social.types';
export declare class SocialActionTrackingService {
    /**
     * Registra execução de uma action
     */
    trackAction(data: {
        tenantId: string;
        globalUserId: string;
        postId: string;
        actionId: string;
        actionType?: string;
        outcome: 'success' | 'cancel' | 'error' | 'pending';
        metadata?: any;
    }): Promise<void>;
    /**
     * Atualiza estado de uma action
     */
    setActionState(data: {
        tenantId: string;
        globalUserId: string;
        postId: string;
        actionId: string;
        state: 'pending' | 'completed' | 'dismissed';
        metadata?: any;
    }): Promise<void>;
    /**
     * Enriquece actions com estados do usuário
     */
    enrichActionsWithStates(tenantId: string, globalUserId: string, posts: Array<{
        postId: string;
        actions?: PostAction[];
    }>): Promise<void>;
    /**
     * Calcula pesos adaptativos para tipos de post baseado em histórico
     */
    calculatePostTypeWeights(tenantId: string, globalUserId: string): Promise<Map<string, number>>;
}
export declare const socialActionTrackingService: SocialActionTrackingService;
//# sourceMappingURL=social-action-tracking.service.d.ts.map