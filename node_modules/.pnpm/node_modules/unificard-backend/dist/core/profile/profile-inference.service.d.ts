import type { UserState, UserProfileSnapshot, InferenceSuggestion, InferenceResult } from './profile-inference.types';
declare class ProfileInferenceService {
    /**
     * Mapeamento de afinidade entre categorias de diferentes contextos
     * Baseado em semântica, não IDs diretos
     */
    private categoryAffinities;
    /**
     * Busca snapshot completo do perfil do usuário
     */
    getUserProfileSnapshot(tenantId: string, userId: string): Promise<UserProfileSnapshot>;
    /**
     * Detecta o estado atual do usuário
     * Método público para uso externo
     */
    detectUserState(snapshot: UserProfileSnapshot): UserState;
    /**
     * Gera sugestões baseadas no estado e padrões do usuário
     */
    generateSuggestions(tenantId: string, userId: string): Promise<InferenceSuggestion[]>;
    /**
     * Busca inferências completas para o usuário
     * Filtra sugestões já dispensadas
     */
    getInferences(tenantId: string, userId: string): Promise<InferenceResult>;
    /**
     * Busca afinidade por categoria física
     */
    private findAffinityByPhysical;
    /**
     * Busca afinidade por categoria de aprendizado
     */
    private findAffinityByLearning;
    /**
     * Busca categoria por slug e contexto
     */
    private findCategoryBySlug;
    /**
     * Registra ação do usuário sobre uma sugestão
     */
    recordSuggestionAction(tenantId: string, userId: string, suggestionId: string, action: 'accept' | 'dismiss'): Promise<void>;
    /**
     * Verifica se uma sugestão já foi dispensada
     */
    isSuggestionDismissed(tenantId: string, userId: string, suggestionId: string): Promise<boolean>;
    /**
     * Filtra sugestões já dispensadas
     */
    filterDismissedSuggestions(tenantId: string, userId: string, suggestions: InferenceSuggestion[]): Promise<InferenceSuggestion[]>;
    /**
     * Busca categoria na árvore recursivamente
     */
    private findCategoryInTree;
}
export declare const profileInferenceService: ProfileInferenceService;
export {};
//# sourceMappingURL=profile-inference.service.d.ts.map