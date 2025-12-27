import type { FeedContextual } from './feed.types';
declare class FeedService {
    /**
     * Gera feed contextual baseado no estado inferido do usuário
     */
    getContextualFeed(tenantId: string, userId: string, limit?: number): Promise<FeedContextual>;
    /**
     * Gera conteúdo de prazer (Físico)
     */
    private generatePleasureContent;
    /**
     * Gera conteúdo de aprendizado
     */
    private generateLearningContent;
    /**
     * Gera conteúdo de transição (histórias, trajetórias)
     */
    private generateTransitionContent;
    /**
     * Gera conteúdo humano (pessoas com afinidade)
     */
    private generateHumanContent;
    /**
     * Gera header contextual baseado no estado
     */
    private generateContextHeader;
}
export declare const feedService: FeedService;
export {};
//# sourceMappingURL=feed.service.d.ts.map