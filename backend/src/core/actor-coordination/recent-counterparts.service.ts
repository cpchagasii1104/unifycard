// backend/src/core/actor-coordination/recent-counterparts.service.ts
// 2026-05-18 P2 — Índice de Coordenação Humana (semente)
//
// Resolve contrapartes recentes de um actor agregando bank_splits
// (SSOT financeiro). READ-ONLY — não modifica nada.
//
// Authority do user sobre o actor DEVE ser validada pelo caller ANTES
// (via actorCapabilitiesService.resolveForUser). Este service apenas
// agrega histórico.
//
// V1 cobre apenas bank_splits — coordenação econômica direta. Outros
// sinais (event_attendees, group_members, social.reactions) ficam para
// v2 conforme uso real puxar.

import { runQueriesWithTenant } from '@core/database/pool';
// DECISION-0189 (F3): actorCapabilitiesService removido — não é decisor (gate = authority canônica)
import type {
  RecentCounterpart,
  RecentCounterpartsResponse,
} from './recent-counterparts.types';

interface CounterpartRow {
  counterpart_actor_id: string;
  counterpart_actor_type: string;
  counterpart_display_name: string;
  counterpart_avatar_url: string | null;
  interaction_count: string; // pg COUNT retorna bigint como string
  total_amount_cents: string;
  last_interaction_at: Date;
}

class RecentCounterpartsService {
  /**
   * Resolve contrapartes recentes para um actor.
   *
   * Authority: caller passa o authenticatedUserId; service valida via
   * actorCapabilitiesService. Sem authority → null (rota responde 403).
   *
   * @param tenantId — escopo de tenant (vinculante)
   * @param actorId — actor cujas contrapartes serão resolvidas
   * @param authenticatedUserId — user JWT autenticado (para authority check)
   * @param windowDays — janela temporal em dias (default 90)
   * @param limit — máximo de contrapartes retornadas (default 10)
   */
  async resolveForUser(
    tenantId: string,
    actorId: string,
    authenticatedUserId: string,
    options: { windowDays?: number; limit?: number } = {}
  ): Promise<RecentCounterpartsResponse | null> {
    const windowDays = Math.max(1, Math.min(365, options.windowDays ?? 90));
    const limit = Math.max(1, Math.min(50, options.limit ?? 10));

    // 1. 🔒 DECISION-0189 (F3): contrapartes recentes DERIVAM de bank_splits (dado financeiro)
    // → autoridade EXATA e TERMINAL (self OU can_view_financial de membership ativa), não
    // projeção de capabilities (que dava a qualquer membro o grafo econômico da empresa).
    const { hasActorFinancialReadAuthority } = await import('@core/authorization/financial-read-authority');
    const gate = await hasActorFinancialReadAuthority(tenantId, authenticatedUserId, actorId);
    if (!gate.allowed) return null;

    // 2. Agregar contrapartes via bank_splits — pares econômicos diretos.
    // bank_splits tem (source_actor_id, target_actor_id, amount_cents).
    // Buscamos todas as linhas onde nosso actor aparece em qualquer lado,
    // identificando o "outro lado" como counterpart.
    const rows = await runQueriesWithTenant<CounterpartRow>(
      tenantId,
      `
      WITH counterparts AS (
        SELECT
          target_actor_id AS counterpart_actor_id,
          amount_cents,
          created_at
        FROM bank_splits
        WHERE tenant_id = $1
          AND source_actor_id = $2
          AND target_actor_id != $2
          AND created_at >= NOW() - ($3 || ' days')::interval
        UNION ALL
        SELECT
          source_actor_id AS counterpart_actor_id,
          amount_cents,
          created_at
        FROM bank_splits
        WHERE tenant_id = $1
          AND target_actor_id = $2
          AND source_actor_id != $2
          AND created_at >= NOW() - ($3 || ' days')::interval
      )
      SELECT
        c.counterpart_actor_id,
        a.actor_type AS counterpart_actor_type,
        a.display_name AS counterpart_display_name,
        a.avatar_url AS counterpart_avatar_url,
        COUNT(*) AS interaction_count,
        SUM(c.amount_cents)::text AS total_amount_cents,
        MAX(c.created_at) AS last_interaction_at
      FROM counterparts c
      INNER JOIN actors a ON a.id = c.counterpart_actor_id AND a.tenant_id = $1
      GROUP BY c.counterpart_actor_id, a.actor_type, a.display_name, a.avatar_url
      ORDER BY interaction_count DESC, last_interaction_at DESC
      LIMIT $4
      `,
      [tenantId, actorId, String(windowDays), limit]
    );

    const counterparts: RecentCounterpart[] = rows.map((r) => ({
      actorId: r.counterpart_actor_id,
      actorType: r.counterpart_actor_type as RecentCounterpart['actorType'],
      displayName: r.counterpart_display_name,
      avatarUrl: r.counterpart_avatar_url,
      interactionCount: Number(r.interaction_count),
      totalAmountCents: Number(r.total_amount_cents),
      lastInteractionAt: r.last_interaction_at.toISOString(),
      windowDays,
    }));

    return {
      actorId,
      windowDays,
      counterparts,
      resolvedAt: new Date().toISOString(),
      source: 'mvp-bank-splits-aggregation',
    };
  }
}

export const recentCounterpartsService = new RecentCounterpartsService();
