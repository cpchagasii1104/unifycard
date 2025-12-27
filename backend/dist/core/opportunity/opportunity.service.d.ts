import type { OpportunityResult } from './opportunity.types';
declare class OpportunityService {
    /**
     * Gera oportunidades contextuais baseadas no estado e progresso do usuário
     * REGRA DURA: Só aparece se:
     * - Aprendizado ativo
     * - Progresso >= Intermediário
     * - Afinidade clara com área profissional
     */
    getContextualOpportunities(tenantId: string, userId: string, limit?: number): Promise<OpportunityResult>;
    /**
     * Gera oportunidades exploratórias
     */
    private generateExploratoryOpportunities;
    /**
     * Gera oportunidades comunitárias
     */
    private generateCommunityOpportunities;
    /**
     * Gera oportunidades profissionais suaves
     */
    private generateProfessionalOpportunities;
    /**
     * Registra ação do usuário sobre uma oportunidade
     */
    recordOpportunityAction(tenantId: string, userId: string, opportunityId: string, action: 'accept' | 'dismiss'): Promise<void>;
    /**
     * Verifica se uma oportunidade já foi dispensada
     */
    isOpportunityDismissed(tenantId: string, userId: string, opportunityId: string): Promise<boolean>;
}
export declare const opportunityService: OpportunityService;
export {};
//# sourceMappingURL=opportunity.service.d.ts.map