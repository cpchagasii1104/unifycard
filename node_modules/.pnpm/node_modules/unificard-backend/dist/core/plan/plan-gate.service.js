"use strict";
// src/core/plan/plan-gate.service.ts
//
// Serviço para controlar acesso a features baseado no plano do usuário
// Gate de acesso para funcionalidades premium
// FASE 3.6: Busca plano real do banco de dados
Object.defineProperty(exports, "__esModule", { value: true });
exports.planGateService = void 0;
const pool_1 = require("@core/database/pool");
class PlanGateService {
    /**
     * Obtém o plano do usuário do banco de dados
     * FASE 3.6: Busca plano real da tabela users
     *
     * @param tenantId ID do tenant
     * @param userIdOrGlobalUserId ID do usuário (local) ou globalUserId
     * @returns Plano do usuário ('free', 'pro' ou 'enterprise')
     */
    async getUserPlan(tenantId, userIdOrGlobalUserId) {
        try {
            // Tentar buscar por user_id primeiro (mais comum)
            const userRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT plan
          FROM users
          WHERE user_id = $1
          LIMIT 1
        `, [userIdOrGlobalUserId]);
            if (userRow && userRow.plan) {
                const plan = userRow.plan.toLowerCase();
                if (plan === 'free' || plan === 'pro' || plan === 'enterprise') {
                    return plan;
                }
            }
            // Se não encontrou por user_id, tentar buscar por global_user_id via link
            const linkRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT u.user_id, u.plan
          FROM users u
          INNER JOIN user_identity_links uil ON uil.user_id = u.user_id
          WHERE uil.global_user_id = $1
          LIMIT 1
        `, [userIdOrGlobalUserId]);
            if (linkRow && linkRow.plan) {
                const plan = linkRow.plan.toLowerCase();
                if (plan === 'free' || plan === 'pro' || plan === 'enterprise') {
                    return plan;
                }
            }
            // Fallback: retornar 'free' como padrão
            return 'free';
        }
        catch (error) {
            console.error('Erro ao buscar plano do usuário:', error);
            // Em caso de erro, retornar 'free' como padrão seguro
            return 'free';
        }
    }
    /**
     * Verifica se o usuário pode usar voz
     * Regras:
     * - FREE → não pode usar voz
     * - PRO/ENTERPRISE → pode usar voz
     */
    async canUseVoice(tenantId, userIdOrGlobalUserId) {
        const plan = await this.getUserPlan(tenantId, userIdOrGlobalUserId);
        return plan !== 'free';
    }
    /**
     * Verifica se o usuário pode usar IA completa
     * Regras:
     * - FREE → apenas texto básico
     * - PRO/ENTERPRISE → IA completa
     */
    async canUseFullAI(tenantId, userIdOrGlobalUserId) {
        const plan = await this.getUserPlan(tenantId, userIdOrGlobalUserId);
        return plan !== 'free';
    }
    /**
     * Obtém configuração completa de features para o plano
     */
    async getPlanFeatures(tenantId, userIdOrGlobalUserId) {
        const plan = await this.getUserPlan(tenantId, userIdOrGlobalUserId);
        return {
            voiceEnabled: plan !== 'free',
            fullAIEnabled: plan !== 'free',
            advancedFeaturesEnabled: plan === 'enterprise',
        };
    }
    /**
     * Valida acesso a uma feature específica
     * Retorna erro se não tiver acesso
     */
    async validateFeatureAccess(tenantId, userIdOrGlobalUserId, feature) {
        const features = await this.getPlanFeatures(tenantId, userIdOrGlobalUserId);
        let hasAccess = false;
        switch (feature) {
            case 'voice':
                hasAccess = features.voiceEnabled;
                break;
            case 'fullAI':
                hasAccess = features.fullAIEnabled;
                break;
            case 'advanced':
                hasAccess = features.advancedFeaturesEnabled;
                break;
        }
        if (!hasAccess) {
            const plan = await this.getUserPlan(tenantId, userIdOrGlobalUserId);
            throw new Error(`Feature '${feature}' não disponível no plano '${plan}'. Upgrade necessário.`);
        }
    }
}
exports.planGateService = new PlanGateService();
//# sourceMappingURL=plan-gate.service.js.map