// src/modules/social/reputation.service.ts
// Serviço para Reputação Progressiva & Permissões (FASE 11)
// REGRA: Reputação é calculada automaticamente baseada em comportamento verificável

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { impactService } from './impact.service';

export type ActorType = 'user' | 'page';

export interface ActorReputation {
  tenant_id: string;
  actor_id: string;
  actor_type: ActorType;
  impact_total: number;
  active_days: number;
  diversity_score: number;
  reputation_level: number;
  created_at: string;
  updated_at: string;
}

export interface ActorPermissions {
  canVote: boolean;
  canCreateProject: boolean;
  canCreateCTA: boolean;
  hasExtendedReach: boolean;
  hasAdvancedAccess: boolean;
}

export class ReputationService {
  /**
   * Calcula e atualiza reputação do ator
   * Fonte de verdade: impact_ledger + impact_balances
   */
  async evaluateReputation(
    tenantId: string,
    actorId: string,
    actorType: ActorType
  ): Promise<ActorReputation> {
    // 1. Buscar saldo de impacto atual
    const balance = await impactService.getBalance(tenantId, actorId, actorType);
    const impactTotal = balance.balance;

    // 2. Calcular dias distintos com atividade
    const activeDaysResult = await runQueryWithTenant<{ distinct_days: number }>(
      tenantId,
      `
      SELECT COUNT(DISTINCT DATE(created_at))::int as distinct_days
      FROM impact_ledger
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
      `,
      [tenantId, actorId, actorType]
    );
    const activeDays = activeDaysResult?.distinct_days || 0;

    // 3. Calcular diversidade (tipos distintos de ações)
    const diversityResult = await runQueryWithTenant<{ distinct_events: number }>(
      tenantId,
      `
      SELECT COUNT(DISTINCT event_type)::int as distinct_events
      FROM impact_ledger
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
      `,
      [tenantId, actorId, actorType]
    );
    const diversityScore = diversityResult?.distinct_events || 0;

    // 4. Calcular nível de reputação baseado nas métricas
    const reputationLevel = this.calculateReputationLevel(impactTotal, activeDays, diversityScore);

    // 4.5. FASE 13: Buscar nível anterior antes de atualizar (para detectar saltos)
    let previousLevel = 0;
    try {
      const existing = await this.getReputation(tenantId, actorId, actorType);
      previousLevel = existing.reputation_level;
    } catch (err) {
      // Ignorar se não existir (primeira vez)
    }

    // 5. Upsert na tabela actor_reputation
    const result = await runQueryWithTenant<{
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      impact_total: number;
      active_days: number;
      diversity_score: number;
      reputation_level: number;
      created_at: string;
      updated_at: string;
    }>(
      tenantId,
      `
      INSERT INTO actor_reputation (
        tenant_id, actor_id, actor_type, impact_total, active_days, diversity_score, reputation_level
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, actor_id, actor_type)
      DO UPDATE SET
        impact_total = EXCLUDED.impact_total,
        active_days = EXCLUDED.active_days,
        diversity_score = EXCLUDED.diversity_score,
        reputation_level = EXCLUDED.reputation_level,
        updated_at = NOW()
      RETURNING tenant_id, actor_id, actor_type, impact_total, active_days, diversity_score, reputation_level, created_at, updated_at
      `,
      [tenantId, actorId, actorType, impactTotal, activeDays, diversityScore, reputationLevel]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao atualizar reputação do ator');
    }

    const row = result[0];

    // FASE 13: Avaliar padrões de reputação (não crítico)
    if (reputationLevel !== previousLevel) {
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.evaluateReputationPatterns(
          tenantId,
          actorId,
          actorType,
          reputationLevel,
          activeDays
        );
      } catch (err) {
        console.warn('Erro ao avaliar padrões de reputação (não crítico):', err);
      }
    }
    return {
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      actor_type: row.actor_type as ActorType,
      impact_total: row.impact_total,
      active_days: row.active_days,
      diversity_score: row.diversity_score,
      reputation_level: row.reputation_level,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Calcula nível de reputação baseado nas métricas
   * MODELO: Simples e defensável
   * 
   * Nível 0: padrão (todos)
   * Nível 1: impacto ≥ 10 E active_days ≥ 3 E diversity ≥ 2
   * Nível 2: impacto ≥ 50 E active_days ≥ 10 E diversity ≥ 3
   * Nível 3: impacto ≥ 150 E active_days ≥ 30 E diversity ≥ 4
   */
  private calculateReputationLevel(
    impactTotal: number,
    activeDays: number,
    diversityScore: number
  ): number {
    // Nível 3: Alto engajamento
    if (impactTotal >= 150 && activeDays >= 30 && diversityScore >= 4) {
      return 3;
    }

    // Nível 2: Engajamento médio
    if (impactTotal >= 50 && activeDays >= 10 && diversityScore >= 3) {
      return 2;
    }

    // Nível 1: Engajamento inicial
    if (impactTotal >= 10 && activeDays >= 3 && diversityScore >= 2) {
      return 1;
    }

    // Nível 0: Padrão (todos começam aqui)
    return 0;
  }

  /**
   * Busca reputação do ator
   */
  async getReputation(
    tenantId: string,
    actorId: string,
    actorType: ActorType
  ): Promise<ActorReputation | null> {
    const result = await runQueryWithTenant<{
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      impact_total: number;
      active_days: number;
      diversity_score: number;
      reputation_level: number;
      created_at: string;
      updated_at: string;
    }>(
      tenantId,
      `
      SELECT tenant_id, actor_id, actor_type, impact_total, active_days, diversity_score, reputation_level, created_at, updated_at
      FROM actor_reputation
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
      LIMIT 1
      `,
      [tenantId, actorId, actorType]
    );

    if (!result || result.length === 0) {
      // Se não existe, retornar reputação padrão (nível 0)
      return {
        tenant_id: tenantId,
        actor_id: actorId,
        actor_type: actorType,
        impact_total: 0,
        active_days: 0,
        diversity_score: 0,
        reputation_level: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const row = result[0];
    return {
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      actor_type: row.actor_type as ActorType,
      impact_total: row.impact_total,
      active_days: row.active_days,
      diversity_score: row.diversity_score,
      reputation_level: row.reputation_level,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Calcula permissões do ator baseado em reputação e status
   * REGRA: Permissões são silenciosas (UI só reflete o que já foi liberado)
   */
  async getPermissions(
    tenantId: string,
    actorId: string,
    actorType: ActorType,
    companyStatus?: string
  ): Promise<ActorPermissions> {
    const reputation = await this.getReputation(tenantId, actorId, actorType);
    const level = reputation.reputation_level;

    // Base: permissões por nível
    const canVote = level >= 1;
    const canCreateProject = level >= 2;
    const canCreateCTA = level >= 2;
    const hasExtendedReach = level >= 2;
    const hasAdvancedAccess = level >= 3;

    // Ajustes específicos para PJ (empresas)
    if (actorType === 'page') {
      // Empresas PROVISIONAL não podem votar nem criar projetos, mesmo com reputação
      if (companyStatus === 'PROVISIONAL') {
        return {
          canVote: false,
          canCreateProject: false,
          canCreateCTA: false,
          hasExtendedReach: hasExtendedReach,
          hasAdvancedAccess: hasAdvancedAccess,
        };
      }

      // Empresas precisam ser VERIFIED+ para ações sensíveis
      if (companyStatus !== 'VERIFIED' && companyStatus !== 'APPROVED') {
        return {
          canVote: false,
          canCreateProject: false,
          canCreateCTA: false,
          hasExtendedReach: hasExtendedReach,
          hasAdvancedAccess: hasAdvancedAccess,
        };
      }
    }

    return {
      canVote,
      canCreateProject,
      canCreateCTA,
      hasExtendedReach,
      hasAdvancedAccess,
    };
  }
}

export const reputationService = new ReputationService();

