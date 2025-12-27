export type UserPlan = 'free' | 'pro' | 'enterprise';
interface PlanGateConfig {
    voiceEnabled: boolean;
    fullAIEnabled: boolean;
    advancedFeaturesEnabled: boolean;
}
declare class PlanGateService {
    /**
     * Obtém o plano do usuário do banco de dados
     * FASE 3.6: Busca plano real da tabela users
     *
     * @param tenantId ID do tenant
     * @param userIdOrGlobalUserId ID do usuário (local) ou globalUserId
     * @returns Plano do usuário ('free', 'pro' ou 'enterprise')
     */
    getUserPlan(tenantId: string, userIdOrGlobalUserId: string): Promise<UserPlan>;
    /**
     * Verifica se o usuário pode usar voz
     * Regras:
     * - FREE → não pode usar voz
     * - PRO/ENTERPRISE → pode usar voz
     */
    canUseVoice(tenantId: string, userIdOrGlobalUserId: string): Promise<boolean>;
    /**
     * Verifica se o usuário pode usar IA completa
     * Regras:
     * - FREE → apenas texto básico
     * - PRO/ENTERPRISE → IA completa
     */
    canUseFullAI(tenantId: string, userIdOrGlobalUserId: string): Promise<boolean>;
    /**
     * Obtém configuração completa de features para o plano
     */
    getPlanFeatures(tenantId: string, userIdOrGlobalUserId: string): Promise<PlanGateConfig>;
    /**
     * Valida acesso a uma feature específica
     * Retorna erro se não tiver acesso
     */
    validateFeatureAccess(tenantId: string, userIdOrGlobalUserId: string, feature: 'voice' | 'fullAI' | 'advanced'): Promise<void>;
}
export declare const planGateService: PlanGateService;
export {};
//# sourceMappingURL=plan-gate.service.d.ts.map