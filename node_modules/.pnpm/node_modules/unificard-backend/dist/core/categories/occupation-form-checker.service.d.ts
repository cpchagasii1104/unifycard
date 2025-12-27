import { CategoryContext } from '@unificard/contracts';
interface OccupationFormResult {
    decision: 'ALLOW' | 'DENY';
    reasonCode?: string;
    suggestion?: string;
}
declare class OccupationFormCheckerService {
    private readonly OCCUPATIONAL_SUFFIXES;
    private readonly FUNCTION_PREFIXES;
    /**
     * Normaliza input para comparação
     */
    private normalizeInput;
    /**
     * Verifica se termo termina com sufixo ocupacional
     */
    private hasOccupationalSuffix;
    /**
     * Verifica se termo começa com prefixo de função
     */
    private hasFunctionPrefix;
    /**
     * Verifica estrutura "cargo + de/em + área" (mínimo 3 palavras)
     */
    private hasValidStructure;
    /**
     * Gera sugestão de forma correta
     */
    private generateSuggestion;
    /**
     * Valida forma ocupacional
     */
    validate(input: string, context?: CategoryContext): OccupationFormResult;
}
export declare const occupationFormCheckerService: OccupationFormCheckerService;
export type { OccupationFormResult };
//# sourceMappingURL=occupation-form-checker.service.d.ts.map