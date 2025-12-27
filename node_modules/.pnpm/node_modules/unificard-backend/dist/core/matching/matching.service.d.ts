import type { MatchResult } from './matching.types';
declare class MatchingService {
    /**
     * Gera sugestões de matching baseadas no estado e afinidade
     */
    getMatchingSuggestions(tenantId: string, userId: string, limit?: number): Promise<MatchResult>;
    /**
     * Gera matches de exploração
     */
    private generateExplorationMatches;
    /**
     * Gera matches de aprendizado
     */
    private generateLearningMatches;
    /**
     * Gera matches de espelhamento
     */
    private generateMirroringMatches;
    /**
     * Registra ação do usuário sobre uma sugestão de match
     */
    recordMatchAction(tenantId: string, userId: string, matchId: string, action: 'accept' | 'dismiss'): Promise<void>;
    /**
     * Verifica se um match já foi dispensado
     */
    isMatchDismissed(tenantId: string, userId: string, matchId: string): Promise<boolean>;
}
export declare const matchingService: MatchingService;
export {};
//# sourceMappingURL=matching.service.d.ts.map