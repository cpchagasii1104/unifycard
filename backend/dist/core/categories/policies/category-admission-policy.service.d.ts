import type { AdmissionDecision, AIContext } from './category-admission-policy.types';
declare class CategoryAdmissionPolicyService {
    private readonly BLOCKED_TERMS;
    private readonly REVIEW_TERMS;
    private readonly ALLOWED_PROFESSIONS;
    private readonly BLOCK_PATTERNS;
    /**
     * Valida categoria profissional usando regras explícitas + IA
     */
    validateProfessionalCategory(input: string, aiContext?: AIContext): Promise<AdmissionDecision>;
    /**
     * Valida categoria de interesse/hobby (regras mais permissivas)
     */
    validateInterestCategory(input: string, aiContext?: AIContext): Promise<AdmissionDecision>;
    /**
     * Normaliza input para comparação
     */
    private normalizeInput;
    /**
     * Verifica termos bloqueados explicitamente
     */
    private checkBlockedTerms;
    /**
     * Verifica padrões de bloqueio (regex)
     */
    private checkBlockPatterns;
    /**
     * Verifica termos que requerem revisão
     */
    private checkReviewTerms;
    /**
     * Verifica profissões reconhecidas
     */
    private checkAllowedProfessions;
    /**
     * Classifica domínio usando IA (se disponível) ou heurísticas
     */
    private classifyDomain;
    /**
     * Verifica se esporte pode ser considerado profissão (ex: "Jogador de Futebol")
     */
    private isSportAsProfession;
    /**
     * Infere tipo de domínio a partir de termo bloqueado
     */
    private inferDomainType;
    /**
     * Infere tipo de domínio a partir de padrão regex
     */
    private inferDomainTypeFromPattern;
}
export declare const categoryAdmissionPolicyService: CategoryAdmissionPolicyService;
export {};
//# sourceMappingURL=category-admission-policy.service.d.ts.map