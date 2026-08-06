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
  createdAt: string;
  updatedAt: string;
}

/**
 * 🔴 BLINDAGEM: Permissões são explícitas e verificáveis
 * NÃO podem ser implícitas ou assumidas automaticamente
 * NÃO são decisão de UI - são validação de backend obrigatória
 */
export interface ActorPermissions {
  canPost: boolean; // 🔴 CRÍTICO: Permissão básica para criar posts
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
    const impactTotal = balance?.balance ?? 0;

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
      // a coluna guarda o TERMO governado; o comparador de salto é ORDINAL — converte pela escada
      if (existing) previousLevel = this.termToLevel(existing.reputation_level);
    } catch (err) {
      // Ignorar se não existir (primeira vez)
    }

    // 5. Upsert na tabela actor_reputation
    const result = await runQueriesWithTenant<{
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
      -- 🔴 CONSERTO 2026-08-06 — o ON CONFLICT citava TRÊS colunas
      -- (tenant_id, actor_id, actor_type) e o índice VIVO tem DUAS:
      --   uq_actor_reputation  UNIQUE (tenant_id, actor_id)     ← lido do catálogo
      -- Sem índice correspondente, o Postgres recusa com 42P10 ("não há restrição de unicidade
      -- que corresponda à especificação ON CONFLICT") — e o caller engolia no catch de
      -- "não crítico". Medido antes do conserto: actor_reputation = **0 linhas**.
      -- É o irmão do NULL da tabela de impacto: código afirmando um schema que não existe, protegido
      -- por catch honesto. A coluna actor_type continua sendo GRAVADA; só não é chave de conflito
      -- — e não deve ser: o mesmo actor não muda de tipo (a identidade é tenant + actor).
      -- (sem crases neste bloco: ele vive DENTRO de um template literal e a crase fecharia a
      --  string — foi assim que este arquivo quebrou o parse na 1a tentativa.)
      ON CONFLICT (tenant_id, actor_id)
      DO UPDATE SET
        impact_total = EXCLUDED.impact_total,
        active_days = EXCLUDED.active_days,
        diversity_score = EXCLUDED.diversity_score,
        reputation_level = EXCLUDED.reputation_level,
        updated_at = NOW()
      RETURNING tenant_id, actor_id, actor_type, impact_total, active_days, diversity_score, reputation_level, NULL::timestamptz AS created_at, updated_at
      `,
      // ⬇️ o degrau vira TERMO governado na fronteira da escrita (nunca número cru na coluna)
      [tenantId, actorId, actorType, impactTotal, activeDays, diversityScore, this.levelToTerm(reputationLevel)]
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
  /**
   * 🔴 A ESCADA, COMPOSTA DO VOCABULÁRIO DO BANCO — não enumerada por conta.
   * `actor_reputation.reputation_level` é TEXTO com CHECK vivo, lido do catálogo em 2026-08-06:
   *   CHECK (reputation_level = ANY (ARRAY['newcomer','member','contributor','leader','champion']))
   * O cálculo interno é uma ESCADA (0,1,2,3 …) e continua sendo — mas o que vai para o banco é o
   * TERMO governado. O índice na tupla É o degrau: posição 0 = newcomer, 1 = member, …
   * ⚠️ Antes daqui, o service gravava o NÚMERO cru numa coluna de texto governado — o CHECK
   * recusava, e o `catch` de "não crítico" de quem chamava engolia. Medido antes do conserto:
   * `actor_reputation` = 0 linhas. É a mesma doença do `type` TS que "afirma" e não checa
   * (`CLAUDE.md §3.2`): o tipo dizia `number`, a coluna dizia vocabulário.
   */
  private static readonly REPUTATION_LADDER = ['newcomer', 'member', 'contributor', 'leader', 'champion'] as const;

  /** degrau numérico → termo governado (fail-closed: fora da escada cai no 1º degrau). */
  private levelToTerm(level: number): string {
    const l = ReputationService.REPUTATION_LADDER;
    return l[Math.max(0, Math.min(l.length - 1, Math.trunc(level)))];
  }

  /** termo governado → degrau numérico (o comparador de "subiu de nível" continua sendo ordinal). */
  private termToLevel(term: unknown): number {
    const i = (ReputationService.REPUTATION_LADDER as readonly string[]).indexOf(String(term));
    return i >= 0 ? i : 0;
  }

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
    const result = await runQueriesWithTenant<{
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
      SELECT tenant_id, actor_id, actor_type, impact_total, active_days, diversity_score, reputation_level, NULL::timestamptz AS created_at, updated_at
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Calcula permissões do ator baseado em reputação e status
   * 🔴 BLINDAGEM: Permissões são explícitas e verificáveis
   * NÃO podem ser implícitas ou assumidas automaticamente
   * NÃO são decisão de UI - são validação de backend obrigatória
   * 
   * 🔴 RELAÇÃO COM CAPACIDADES:
   * - Capacidade: ação possível no sistema, associada ao tipo de Actor
   * - Permissão: validação pontual baseada em estado (reputação, verificação, etc)
   * - Permissão valida capacidade - se não tem capacidade, permissão é irrelevante
   * 
   * 🔴 LEGACY — NÃO USAR COMO DECISÃO DE AUTORIZAÇÃO
   * Este método retorna métricas/INPUT, não autorização.
   * NÃO usar getPermissions() para decidir permissões.
   * Decisão final DEVE passar por authority.service (fachada modules) / canActAs no core.
   */
  async getPermissions(
    tenantId: string,
    actorId: string,
    actorType: ActorType,
    _companyStatus?: string // DECISION-0092 Fase 3.0: NÃO é mais fonte de capability (eixo congelado pela Fase 2). Mantido p/ compat de assinatura; IGNORADO.
  ): Promise<ActorPermissions> {
    const reputation = await this.getReputation(tenantId, actorId, actorType);
    const level = reputation?.reputation_level ?? 0;

    // 🔴 VALIDAÇÃO: Verificar capacidade antes de calcular permissão
    // Se não tem capacidade, permissão é false
    const { actorCapabilitiesService } = await import('./actor-capabilities.service');
    const { ActorCapability } = await import('./actor-capabilities.types');
    const capabilities = actorCapabilitiesService.getCapabilitiesByType(actorType);

    const hasPostCapability = capabilities.includes(ActorCapability.POST_CONTENT);
    const hasVoteCapability = capabilities.includes(ActorCapability.VOTE);
    const hasProjectCapability = capabilities.includes(ActorCapability.CREATE_PROJECT);
    const hasCTACapability = capabilities.includes(ActorCapability.CREATE_CTA);

    const hasExtendedReach = level >= 2;
    const hasAdvancedAccess = level >= 3;

    // DECISION-0092 Fase 3.0: verificação de PJ deriva EXCLUSIVAMENTE de fiscal_identities.kyb_status
    // (NUNCA company_status/is_verified — eixo congelado pela Fase 2). Resolução server-side (não confia
    // em valor passado pelo caller/cliente), fail-closed.
    if (actorType === 'page') {
      const isPjApproved = await this.resolveKybApproved(tenantId, actorId);

      // PJ sem KYB approved (pending/rejected/suspended/closed/sem-fiscal): presença básica permitida,
      // mas SEM post/vote/project/CTA — capability sensível exige kyb_status='approved'.
      if (!isPjApproved) {
        return {
          canPost: false,
          canVote: false,
          canCreateProject: false,
          canCreateCTA: false,
          hasExtendedReach,
          hasAdvancedAccess,
        };
      }
    }

    // Base: permissões por nível (reputação). PJ que chega aqui já é kyb_status='approved'.
    // 🔴 REGRA: Permissão = Capacidade + Estado (reputação/verificação)
    const canPost = hasPostCapability; // PF sempre; PJ só se approved (garantido pelo guard acima)
    const canVote = hasVoteCapability && level >= 1;
    const canCreateProject = hasProjectCapability && level >= 2;
    const canCreateCTA = hasCTACapability && level >= 2;

    return {
      canPost,
      canVote,
      canCreateProject,
      canCreateCTA,
      hasExtendedReach,
      hasAdvancedAccess,
    };
  }

  /**
   * DECISION-0092 Fase 3.0: resolve se a PJ do page-actor está com KYB aprovado.
   * FONTE ÚNICA = fiscal_identities.kyb_status='approved' (page→company→fiscal_identity, espelha o gate F2-C).
   * Fail-closed: qualquer elo ausente/quebrado → false. NUNCA infere por company_status/is_verified.
   */
  private async resolveKybApproved(tenantId: string, actorId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ kyb_status: string | null }>(
      tenantId,
      `SELECT fi.kyb_status::text AS kyb_status
         FROM actors a
         LEFT JOIN companies c ON c.company_id = a.company_id AND c.tenant_id = a.tenant_id
         LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
        WHERE a.tenant_id = $1 AND a.id = $2::uuid
        LIMIT 1`,
      [tenantId, actorId]
    );
    return row?.kyb_status === 'approved';
  }
}

export const reputationService = new ReputationService();



