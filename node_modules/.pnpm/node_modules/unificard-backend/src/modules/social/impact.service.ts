// src/modules/social/impact.service.ts
// Serviço central para Impacto Real + Ledger por Ator (FASE 10)
// REGRA: Nenhuma mudança de impacto pode acontecer sem um evento no ledger

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type ImpactEventType = 'LIKE' | 'SUPPORT' | 'JOIN_GROUP' | 'POST_PUBLISHED';
export type ImpactSourceType = 'post' | 'group' | 'project' | 'system';
export type ActorType = 'user' | 'page';

export interface ImpactLedgerEntry {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: ActorType;
  event_type: ImpactEventType;
  impact_delta: number;
  source_type: ImpactSourceType;
  source_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface ImpactBalance {
  tenant_id: string;
  actor_id: string;
  actor_type: ActorType;
  balance: number;
  updated_at: string;
}

export interface RecordImpactParams {
  tenantId: string;
  actor: {
    actor_id: string;
    actor_type: ActorType;
  };
  eventType: ImpactEventType;
  delta: number;
  sourceType: ImpactSourceType;
  sourceId: string;
  metadata?: Record<string, any>;
}

export class ImpactService {
  /**
   * Registra impacto no ledger e atualiza saldo (em transação)
   * REGRA: Único ponto de escrita para impacto. Proibido atualizar impacto fora daqui.
   */
  async recordImpact(params: RecordImpactParams): Promise<{ newBalance: number; entry: ImpactLedgerEntry }> {
    const { tenantId, actor, eventType, delta, sourceType, sourceId, metadata } = params;

    // Validar delta não pode ser zero
    if (delta === 0) {
      throw new Error('impact_delta não pode ser zero');
    }

    // Validar delta positivo (por enquanto, sem penalidades)
    if (delta < 0) {
      throw new Error('impact_delta deve ser positivo (penalidades não implementadas ainda)');
    }

    // Executar em transação: inserir no ledger + atualizar saldo
    const result = await runQueryWithTenant<{
      entry_id: string;
      entry_created_at: string;
      new_balance: number;
      balance_updated_at: string;
    }>(
      tenantId,
      `
      WITH ledger_insert AS (
        INSERT INTO impact_ledger (
          tenant_id, actor_id, actor_type, event_type, impact_delta,
          source_type, source_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING id, created_at
      ),
      balance_upsert AS (
        INSERT INTO impact_balances (tenant_id, actor_id, actor_type, balance)
        VALUES ($1, $2, $3, $5)
        ON CONFLICT (tenant_id, actor_id, actor_type)
        DO UPDATE SET
          balance = impact_balances.balance + $5,
          updated_at = NOW()
        RETURNING balance, updated_at
      )
      SELECT 
        li.id as entry_id,
        li.created_at::text as entry_created_at,
        bu.balance as new_balance,
        bu.updated_at::text as balance_updated_at
      FROM ledger_insert li
      CROSS JOIN balance_upsert bu
      `,
      [
        tenantId,
        actor.actor_id,
        actor.actor_type,
        eventType,
        delta,
        sourceType,
        sourceId,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao registrar impacto no ledger');
    }

    const row = result[0];

    const impactResult = {
      newBalance: row.new_balance,
      entry: {
        id: row.entry_id,
        tenant_id: tenantId,
        actor_id: actor.actor_id,
        actor_type: actor.actor_type,
        event_type: eventType,
        impact_delta: delta,
        source_type: sourceType,
        source_id: sourceId,
        metadata: metadata || null,
        created_at: row.entry_created_at,
      },
    };

    // FASE 11: Avaliar reputação após registrar impacto (não crítico)
    try {
      const { reputationService } = await import('./reputation.service');
      await reputationService.evaluateReputation(tenantId, actor.actor_id, actor.actor_type);
    } catch (err) {
      // Não quebra registro de impacto se reputação falhar (log apenas)
      console.warn('Erro ao avaliar reputação após impacto (não crítico):', err);
    }

    // FASE 13: Avaliar padrões de impacto e diversidade (não crítico)
    // Usar import dinâmico para evitar dependência circular
    try {
      const auditModule = await import('@core/audit/audit.service');
      await auditModule.auditService.evaluateImpactPatterns(tenantId, actor.actor_id, actor.actor_type, result.newBalance);
      await auditModule.auditService.evaluateActionDiversity(tenantId, actor.actor_id, actor.actor_type);
    } catch (err) {
      console.warn('Erro ao avaliar padrões de impacto (não crítico):', err);
    }

    return impactResult;
  }

  /**
   * Busca saldo de impacto do ator
   */
  async getBalance(
    tenantId: string,
    actorId: string,
    actorType: ActorType
  ): Promise<ImpactBalance | null> {
    const result = await runQueryWithTenant<{
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      balance: number;
      updated_at: string;
    }>(
      tenantId,
      `
      SELECT tenant_id, actor_id, actor_type, balance, updated_at
      FROM impact_balances
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
      LIMIT 1
      `,
      [tenantId, actorId, actorType]
    );

    if (!result || result.length === 0) {
      // Se não existe, retornar saldo zero (primeira vez)
      return {
        tenant_id: tenantId,
        actor_id: actorId,
        actor_type: actorType,
        balance: 0,
        updated_at: new Date().toISOString(),
      };
    }

    const row = result;
    return {
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      actor_type: row.actor_type as ActorType,
      balance: row.balance,
      updated_at: row.updated_at,
    };
  }

  /**
   * Busca histórico do ledger (extrato)
   */
  async getLedgerHistory(
    tenantId: string,
    actorId: string,
    actorType: ActorType,
    limit: number = 20
  ): Promise<ImpactLedgerEntry[]> {
    const result = await runQueriesWithTenant<{
      id: string;
      tenant_id: string;
      actor_id: string;
      actor_type: string;
      event_type: string;
      impact_delta: number;
      source_type: string;
      source_id: string;
      metadata: any;
      created_at: string;
    }>(
      tenantId,
      `
      SELECT 
        id, tenant_id, actor_id, actor_type, event_type, impact_delta,
        source_type, source_id, metadata, created_at
      FROM impact_ledger
      WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
      ORDER BY created_at DESC
      LIMIT $4
      `,
      [tenantId, actorId, actorType, limit]
    );

    return result.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      actor_type: row.actor_type as ActorType,
      event_type: row.event_type as ImpactEventType,
      impact_delta: row.impact_delta,
      source_type: row.source_type as ImpactSourceType,
      source_id: row.source_id,
      metadata: row.metadata,
      created_at: row.created_at,
    }));
  }
}

export const impactService = new ImpactService();

