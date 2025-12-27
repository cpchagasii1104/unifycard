interface LexicalGateResult {
    decision: 'ALLOW' | 'DENY';
    reasonCode?: string;
    normalized?: string;
}
declare class CategoryLexicalGateService {
    private readonly BLACKLIST;
    private readonly WHITELIST;
    /**
     * Normaliza input para comparação
     */
    private normalizeInput;
    /**
     * Divide texto em palavras (split por whitespace)
     */
    private splitWords;
    /**
     * Verifica se alguma palavra completa está na blacklist
     */
    private checkBlacklist;
    /**
     * Verifica se está na whitelist (sobrescreve blacklist)
     * FASE 3.7.1: Hardening - Match exato ou n-gram completo, NUNCA substring
     * REGRA: Apenas comparação exata de palavras/frases completas
     */
    private checkWhitelist;
    /**
     * Valida entrada léxica
     * Performance: 0-2ms (apenas comparações em memória)
     */
    validate(input: string): LexicalGateResult;
}
export declare const categoryLexicalGateService: CategoryLexicalGateService;
export type { LexicalGateResult };
//# sourceMappingURL=category-lexical-gate.service.d.ts.map