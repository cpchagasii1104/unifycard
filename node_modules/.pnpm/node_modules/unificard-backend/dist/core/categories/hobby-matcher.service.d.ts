interface HobbyMatchResult {
    matched: boolean;
    canonicalHobby?: string;
    similarity?: number;
    reasonCode?: string;
}
declare class HobbyMatcherService {
    private hobbies;
    private initialized;
    /**
     * Carrega dataset de hobbies do arquivo JSON
     */
    private loadHobbiesDataset;
    /**
     * Normaliza input para comparação
     */
    private normalizeInput;
    /**
     * Match exato no dataset
     */
    private findExactMatch;
    /**
     * Match fuzzy usando pg_trgm
     * Threshold: >= 0.85
     * Limite: 3 resultados
     */
    private findFuzzyMatch;
    /**
     * Matching simples sem pg_trgm (fallback)
     * Usa similaridade de strings básica
     */
    private findSimpleFuzzyMatch;
    /**
     * Calcula similaridade simples entre duas strings
     * Usa Jaro-Winkler-like ou Levenshtein normalizado
     */
    private calculateSimpleSimilarity;
    /**
     * Busca match de hobby
     *
     * Fluxo:
     * 1. Match exato → ALLOW
     * 2. Fuzzy >= 0.85 → ALLOW (canonical_id)
     * 3. Senão → DENY
     */
    findMatch(input: string): Promise<HobbyMatchResult>;
    /**
     * Verifica se hobby está no dataset (sem fuzzy)
     * Útil para validação rápida
     */
    isInDataset(input: string): Promise<boolean>;
}
export declare const hobbyMatcherService: HobbyMatcherService;
export type { HobbyMatchResult };
//# sourceMappingURL=hobby-matcher.service.d.ts.map