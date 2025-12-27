interface HobbyVerbResult {
    decision: 'ALLOW' | 'DENY';
    reasonCode?: string;
    suggestion?: string;
}
declare class HobbyVerbHeuristicService {
    private readonly BLOCKED_START_VERBS;
    private readonly BLOCKED_END_GERUNDS;
    /**
     * Normaliza input para comparação
     */
    private normalizeInput;
    /**
     * Divide texto em palavras
     */
    private splitWords;
    /**
     * Verifica se começa com verbo genérico bloqueado
     */
    private startsWithBlockedVerb;
    /**
     * Verifica se termina com gerúndio genérico bloqueado
     */
    private endsWithBlockedGerund;
    /**
     * Valida heurística verbal para hobbies
     *
     * BLOQUEIA:
     * - "ligar videogame"
     * - "mexer no celular"
     * - "ficar no computador"
     * - "abrir instagram"
     * - "jogando" (sem objeto)
     *
     * PERMITE (será validado pelo HobbyMatcher):
     * - "tocar violão" (verbo + objeto válido)
     * - "jogar xadrez" (verbo + objeto válido)
     * - "praticar ioga" (verbo + objeto válido)
     */
    validate(input: string): HobbyVerbResult;
}
export declare const hobbyVerbHeuristicService: HobbyVerbHeuristicService;
export type { HobbyVerbResult };
//# sourceMappingURL=hobby-verb-heuristic.service.d.ts.map