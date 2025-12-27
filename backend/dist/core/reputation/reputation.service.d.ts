import type { ReputationScore, ReviewCreatedEventPayload } from './reputation.types';
declare class ReputationService {
    private toScore;
    getScore(tenantId: string, entityType: string, entityId: string): Promise<ReputationScore | null>;
    /**
     * Busca reputação por global_user_id
     * Agrega scores de todos os tenants onde o usuário tem reputação
     * NOTA: Esta função não usa RLS pois precisa buscar em múltiplos tenants
     */
    getScoreByGlobalUserId(globalUserId: string): Promise<{
        globalUserId: string;
        scores: {
            global: number;
            work?: number;
            rides?: number;
            events?: number;
            commerce?: number;
        };
        summary: {
            totalReviews: number;
            lastReviewAt?: string;
            averageScore: number;
        };
    } | null>;
    /**
     * Atualiza reputação incrementalmente com base em um novo review.
     * Estratégia simples:
     * new_avg = (old_avg * n + rating) / (n+1)
     */
    applyReview(tenantId: string, payload: ReviewCreatedEventPayload): Promise<ReputationScore>;
}
export declare const reputationService: ReputationService;
export {};
//# sourceMappingURL=reputation.service.d.ts.map