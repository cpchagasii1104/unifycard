// src/core/plan/plan-gate.service.ts
//
// Serviço para controlar acesso a features baseado no plano do usuário
// Gate de acesso para funcionalidades premium
// FASE 3.6: Busca plano real do banco de dados

import { runQueryWithTenant } from '@core/database/pool';

export type UserPlan = 'free' | 'pro' | 'enterprise';

interface PlanGateConfig {
  voiceEnabled: boolean;
  fullAIEnabled: boolean;
  advancedFeaturesEnabled: boolean;
}

class PlanGateService {
  /**
   * Obtém o plano do usuário do banco de dados
   * 🔴 REGRA: Plano é TENANT-SCOPED - decisão ocorre exclusivamente por (user_id, tenant_id)
   * DEV MODE: Permite override via variável de ambiente VITE_DEV_PLAN
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param userId ID do usuário local (OBRIGATÓRIO)
   * @returns Plano do usuário ('free', 'pro' ou 'enterprise')
   * @throws Error se usuário não encontrado
   */
  async getUserPlan(tenantId: string, userId: string): Promise<UserPlan> {
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Permitir testar features de planos PRO/ENTERPRISE em desenvolvimento (exceção ao modelo padrão)
     * Contexto: Ambiente de desenvolvimento local
     * Tipo: temporária
     */
    // 🔴 DEV MODE: Verificar flag de ambiente para permitir features em DEV
    const devPlan = process.env.VITE_DEV_PLAN || process.env.DEV_PLAN;
    if (devPlan && (devPlan === 'pro' || devPlan === 'enterprise')) {
      console.log(`[PlanGate] DEV MODE: Usando plano ${devPlan} via variável de ambiente`);
      return devPlan as UserPlan;
    }

    // 🔴 REGRA CANÔNICA: Resolver plano diretamente por (user_id, tenant_id)
    const userRow = await runQueryWithTenant<{ plan: string | null }>(
      tenantId,
      `
        SELECT plan
        FROM users
        WHERE user_id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!userRow || !userRow.plan) {
      throw new Error(`Plano não encontrado para user_id: ${userId} no tenant: ${tenantId}`);
    }

    const plan = userRow.plan.toLowerCase() as UserPlan;
    if (plan === 'free' || plan === 'pro' || plan === 'enterprise') {
      return plan;
    }

    throw new Error(`Plano inválido '${plan}' para user_id: ${userId} no tenant: ${tenantId}`);
  }

  /**
   * Obtém o plano do usuário a partir de actorId
   * 🔴 REGRA: Resolver OBRIGATORIAMENTE via actors para obter user_id, depois users para obter plan
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param actorId ID do actor (OBRIGATÓRIO)
   * @returns Plano do usuário ('free', 'pro' ou 'enterprise')
   * @throws Error se actor ou usuário não encontrado
   */
  async getUserPlanByActorId(tenantId: string, actorId: string): Promise<UserPlan> {
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Permitir testar features de planos PRO/ENTERPRISE em desenvolvimento (exceção ao modelo padrão)
     * Contexto: Ambiente de desenvolvimento local
     * Tipo: temporária
     */
    // 🔴 DEV MODE: Verificar flag de ambiente para permitir features em DEV
    const devPlan = process.env.VITE_DEV_PLAN || process.env.DEV_PLAN;
    if (devPlan && (devPlan === 'pro' || devPlan === 'enterprise')) {
      console.log(`[PlanGate] DEV MODE: Usando plano ${devPlan} via variável de ambiente`);
      return devPlan as UserPlan;
    }

    // 🔴 REGRA CANÔNICA: Resolver user_id via actors primeiro
    const actorRow = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
        SELECT user_id
        FROM actors
        WHERE actor_id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [actorId, tenantId]
    );

    if (!actorRow || !actorRow.user_id) {
      throw new Error(`Actor não encontrado para actor_id: ${actorId} no tenant: ${tenantId}`);
    }

    // Resolver plano usando user_id obtido do actor
    return this.getUserPlan(tenantId, actorRow.user_id);
  }

  /**
   * Verifica se o usuário pode usar voz
   * Regras:
   * - FREE → não pode usar voz
   * - PRO/ENTERPRISE → pode usar voz
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param userId ID do usuário local (OBRIGATÓRIO)
   */
  async canUseVoice(tenantId: string, userId: string): Promise<boolean> {
    const plan = await this.getUserPlan(tenantId, userId);
    return plan !== 'free';
  }

  /**
   * Verifica se o usuário pode usar voz (via actorId)
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param actorId ID do actor (OBRIGATÓRIO)
   */
  async canUseVoiceByActorId(tenantId: string, actorId: string): Promise<boolean> {
    const plan = await this.getUserPlanByActorId(tenantId, actorId);
    return plan !== 'free';
  }

  /**
   * Verifica se o usuário pode usar IA completa
   * Regras:
   * - FREE → apenas texto básico
   * - PRO/ENTERPRISE → IA completa
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param userId ID do usuário local (OBRIGATÓRIO)
   */
  async canUseFullAI(tenantId: string, userId: string): Promise<boolean> {
    const plan = await this.getUserPlan(tenantId, userId);
    return plan !== 'free';
  }

  /**
   * Verifica se o usuário pode usar IA completa (via actorId)
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param actorId ID do actor (OBRIGATÓRIO)
   */
  async canUseFullAIByActorId(tenantId: string, actorId: string): Promise<boolean> {
    const plan = await this.getUserPlanByActorId(tenantId, actorId);
    return plan !== 'free';
  }

  /**
   * Obtém configuração completa de features para o plano
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param userId ID do usuário local (OBRIGATÓRIO)
   */
  async getPlanFeatures(tenantId: string, userId: string): Promise<PlanGateConfig> {
    const plan = await this.getUserPlan(tenantId, userId);
    
    return {
      voiceEnabled: plan !== 'free',
      fullAIEnabled: plan !== 'free',
      advancedFeaturesEnabled: plan === 'enterprise',
    };
  }

  /**
   * Obtém configuração completa de features para o plano (via actorId)
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param actorId ID do actor (OBRIGATÓRIO)
   */
  async getPlanFeaturesByActorId(tenantId: string, actorId: string): Promise<PlanGateConfig> {
    const plan = await this.getUserPlanByActorId(tenantId, actorId);
    
    return {
      voiceEnabled: plan !== 'free',
      fullAIEnabled: plan !== 'free',
      advancedFeaturesEnabled: plan === 'enterprise',
    };
  }

  /**
   * Valida acesso a uma feature específica
   * Retorna erro se não tiver acesso
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param userId ID do usuário local (OBRIGATÓRIO)
   * @param feature Feature a validar
   */
  async validateFeatureAccess(
    tenantId: string,
    userId: string,
    feature: 'voice' | 'fullAI' | 'advanced'
  ): Promise<void> {
    const features = await this.getPlanFeatures(tenantId, userId);
    
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
      const plan = await this.getUserPlan(tenantId, userId);
      throw new Error(
        `Feature '${feature}' não disponível no plano '${plan}'. Upgrade necessário.`
      );
    }
  }

  /**
   * Valida acesso a uma feature específica (via actorId)
   * Retorna erro se não tiver acesso
   * 
   * @param tenantId ID do tenant (OBRIGATÓRIO)
   * @param actorId ID do actor (OBRIGATÓRIO)
   * @param feature Feature a validar
   */
  async validateFeatureAccessByActorId(
    tenantId: string,
    actorId: string,
    feature: 'voice' | 'fullAI' | 'advanced'
  ): Promise<void> {
    const features = await this.getPlanFeaturesByActorId(tenantId, actorId);
    
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
      const plan = await this.getUserPlanByActorId(tenantId, actorId);
      throw new Error(
        `Feature '${feature}' não disponível no plano '${plan}'. Upgrade necessário.`
      );
    }
  }
}

export const planGateService = new PlanGateService();























