interface CBOMatchResult {
    matched: boolean;
    canonicalId?: string;
    cboCode?: string;
    title?: string;
    similarity?: number;
    reasonCode?: string;
}
declare class CBOMatcherService {
    /**
     * Normaliza input para busca
     */
    private normalizeInput;
    /**
     * Busca no CBO usando fuzzy match (pg_trgm)
     * Performance: <50ms com índices adequados
     */
    findMatch(input: string): Promise<CBOMatchResult>;
    /**
     * Busca exata por sinônimo
     */
    findExactMatch(input: string): Promise<CBOMatchResult>;
}
export declare const cboMatcherService: CBOMatcherService;
export type { CBOMatchResult };
//# sourceMappingURL=cbo-matcher.service.d.ts.map