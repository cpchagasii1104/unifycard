// src/modules/groups/votes.repository.ts
//
// Dono ÚNICO do SQL de groups votes. Schema actor-keyed (migration
// 20260530430000): group_votes.id/created_by_actor_id, group_vote_options.id/label,
// group_vote_responses.id/actor_id (UNIQUE vote_id, actor_id).
// Métodos de criação aceitam `trx` opcional (transação do caller) para preservar
// atomicidade sem duplicar SQL no service (F-GROUPS-VOTES-SCHEMA-DRIFT-FIX).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  GroupVote,
  GroupVoteOption,
  GroupVoteResponse,
  CreateVoteInput,
} from './votes.types';
import { toGroupVote, toGroupVoteOption, toGroupVoteResponse } from './votes.types';

/** Transação tenant do `runTenantTransaction` (@core/db): query→rows. */
type TenantTrx = { query: (q: { text: string; values?: unknown[] }) => Promise<any[]> };

const toIso = (v: Date | string): string =>
  v instanceof Date ? v.toISOString() : String(v);

class VotesRepository {
  /** Executa retornando a 1ª linha (com trx do caller ou conexão tenant própria). */
  private async one<T>(
    tenantId: string,
    text: string,
    values: unknown[],
    trx?: TenantTrx
  ): Promise<T | null> {
    if (trx) {
      const rows = await trx.query({ text, values });
      return (rows[0] as T) ?? null;
    }
    return (await runQueryWithTenant<T>(tenantId, text, values as (string | number | null)[])) ?? null;
  }

  /** Executa retornando todas as linhas. */
  private async many<T>(
    tenantId: string,
    text: string,
    values: unknown[],
    trx?: TenantTrx
  ): Promise<T[]> {
    if (trx) {
      return (await trx.query({ text, values })) as T[];
    }
    return runQueriesWithTenant<T>(tenantId, text, values as (string | number | null)[]);
  }

  private normalizeVoteRow(row: {
    id: string;
    tenant_id: string;
    group_id: string;
    created_by_actor_id: string;
    title: string;
    description: string | null;
    status: string;
    is_anonymous: boolean;
    closes_at: Date | null;
    created_at: Date | string;
    updated_at: Date | string;
  }): Parameters<typeof toGroupVote>[0] {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      group_id: row.group_id,
      created_by_actor_id: row.created_by_actor_id,
      title: row.title,
      description: row.description,
      status: row.status,
      is_anonymous: row.is_anonymous,
      closesAt: row.closes_at,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private normalizeVoteOptionRow(row: {
    id: string;
    vote_id: string;
    tenant_id: string;
    label: string;
    display_order: number;
    created_at: Date | string;
  }): Parameters<typeof toGroupVoteOption>[0] {
    return {
      id: row.id,
      vote_id: row.vote_id,
      tenant_id: row.tenant_id,
      label: row.label,
      display_order: row.display_order,
      createdAt: toIso(row.created_at),
    };
  }

  private normalizeVoteResponseRow(row: {
    id: string;
    vote_id: string;
    option_id: string;
    tenant_id: string;
    actor_id: string;
    created_at: Date | string;
  }): Parameters<typeof toGroupVoteResponse>[0] {
    return {
      id: row.id,
      vote_id: row.vote_id,
      option_id: row.option_id,
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      createdAt: toIso(row.created_at),
    };
  }

  private static readonly VOTE_COLS =
    'id, tenant_id, group_id, created_by_actor_id, title, description, status, is_anonymous, closes_at, created_at, updated_at';
  private static readonly OPTION_COLS =
    'id, vote_id, tenant_id, label, display_order, created_at';
  private static readonly RESPONSE_COLS =
    'id, vote_id, option_id, tenant_id, actor_id, created_at';

  async createVote(
    tenantId: string,
    groupId: string,
    createdByActorId: string,
    input: CreateVoteInput,
    trx?: TenantTrx
  ): Promise<GroupVote> {
    const row = await this.one<Parameters<VotesRepository['normalizeVoteRow']>[0]>(
      tenantId,
      `
      INSERT INTO group_votes (
        tenant_id, group_id, created_by_actor_id, title, description, status, closes_at
      )
      VALUES ($1, $2, $3, $4, $5, 'open', $6)
      RETURNING ${VotesRepository.VOTE_COLS}
      `,
      [
        tenantId,
        groupId,
        createdByActorId,
        input.title,
        input.description ?? null,
        input.closesAt ? new Date(input.closesAt) : null,
      ],
      trx
    );

    if (!row) {
      throw new Error('Falha ao criar votação');
    }

    return toGroupVote(this.normalizeVoteRow(row));
  }

  async createVoteOptions(
    tenantId: string,
    voteId: string,
    options: string[],
    trx?: TenantTrx
  ): Promise<GroupVoteOption[]> {
    const createdOptions: GroupVoteOption[] = [];

    for (let i = 0; i < options.length; i++) {
      const row = await this.one<Parameters<VotesRepository['normalizeVoteOptionRow']>[0]>(
        tenantId,
        `
        INSERT INTO group_vote_options (
          vote_id, tenant_id, label, display_order
        )
        VALUES ($1, $2, $3, $4)
        RETURNING ${VotesRepository.OPTION_COLS}
        `,
        [voteId, tenantId, options[i], i],
        trx
      );

      if (row) {
        createdOptions.push(toGroupVoteOption(this.normalizeVoteOptionRow(row)));
      }
    }

    return createdOptions;
  }

  async getVote(tenantId: string, voteId: string): Promise<GroupVote | null> {
    const row = await this.one<Parameters<VotesRepository['normalizeVoteRow']>[0]>(
      tenantId,
      `
      SELECT ${VotesRepository.VOTE_COLS}
      FROM group_votes
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [voteId, tenantId]
    );

    return row ? toGroupVote(this.normalizeVoteRow(row)) : null;
  }

  async getVoteOptions(tenantId: string, voteId: string): Promise<GroupVoteOption[]> {
    const rows = await this.many<Parameters<VotesRepository['normalizeVoteOptionRow']>[0]>(
      tenantId,
      `
      SELECT ${VotesRepository.OPTION_COLS}
      FROM group_vote_options
      WHERE vote_id = $1 AND tenant_id = $2
      ORDER BY display_order ASC
      `,
      [voteId, tenantId]
    );

    return rows.map((r) => toGroupVoteOption(this.normalizeVoteOptionRow(r)));
  }

  async getVoteCounts(tenantId: string, voteId: string): Promise<Map<string, number>> {
    const rows = await this.many<{ option_id: string; vote_count: string }>(
      tenantId,
      `
      SELECT option_id, COUNT(*) as vote_count
      FROM group_vote_responses
      WHERE vote_id = $1 AND tenant_id = $2
      GROUP BY option_id
      `,
      [voteId, tenantId]
    );

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.option_id, parseInt(row.vote_count, 10));
    }

    return counts;
  }

  /** Voto existente de um ACTOR nesta votação (identidade operacional = actor_id). */
  async getActorVote(
    tenantId: string,
    voteId: string,
    actorId: string
  ): Promise<GroupVoteResponse | null> {
    const row = await this.one<Parameters<VotesRepository['normalizeVoteResponseRow']>[0]>(
      tenantId,
      `
      SELECT ${VotesRepository.RESPONSE_COLS}
      FROM group_vote_responses
      WHERE vote_id = $1 AND tenant_id = $2 AND actor_id = $3
      LIMIT 1
      `,
      [voteId, tenantId, actorId]
    );

    return row ? toGroupVoteResponse(this.normalizeVoteResponseRow(row)) : null;
  }

  async createVoteResponse(
    tenantId: string,
    voteId: string,
    optionId: string,
    actorId: string,
    trx?: TenantTrx
  ): Promise<GroupVoteResponse> {
    const row = await this.one<Parameters<VotesRepository['normalizeVoteResponseRow']>[0]>(
      tenantId,
      `
      INSERT INTO group_vote_responses (
        vote_id, option_id, tenant_id, actor_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING ${VotesRepository.RESPONSE_COLS}
      `,
      [voteId, optionId, tenantId, actorId],
      trx
    );

    if (!row) {
      throw new Error('Falha ao registrar voto');
    }

    return toGroupVoteResponse(this.normalizeVoteResponseRow(row));
  }

  async getGroupVotes(
    tenantId: string,
    groupId: string,
    status?: 'open' | 'closed'
  ): Promise<GroupVote[]> {
    let query = `
      SELECT ${VotesRepository.VOTE_COLS}
      FROM group_votes
      WHERE group_id = $1 AND tenant_id = $2
    `;
    const params: (string | number)[] = [groupId, tenantId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await this.many<Parameters<VotesRepository['normalizeVoteRow']>[0]>(
      tenantId,
      query,
      params
    );

    return rows.map((r) => toGroupVote(this.normalizeVoteRow(r)));
  }

  /**
   * Votantes por opção. Identidade = actor_id (join em actors por actors.id),
   * NÃO users.global_user_id. Anonimato NÃO é aplicado aqui — ver
   * DT-GROUPS-VOTES-ANONYMITY-NOT-ENFORCED (OPEN/DECISION_REQUIRED).
   */
  async getVotersByOption(tenantId: string, voteId: string): Promise<Array<{
    optionId: string;
    actorId: string;
    actorName: string | null;
    createdAt: Date;
  }>> {
    const rows = await this.many<{
      option_id: string;
      actor_id: string;
      display_name: string | null;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT gvr.option_id, gvr.actor_id, a.display_name, gvr.created_at
      FROM group_vote_responses gvr
      LEFT JOIN actors a ON a.id = gvr.actor_id AND a.tenant_id = $2
      WHERE gvr.vote_id = $1 AND gvr.tenant_id = $2
      ORDER BY gvr.option_id, gvr.created_at
      `,
      [voteId, tenantId]
    );

    return rows.map((row) => ({
      optionId: row.option_id,
      actorId: row.actor_id,
      actorName: row.display_name || null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }

  async closeVote(tenantId: string, voteId: string): Promise<GroupVote> {
    const row = await this.one<Parameters<VotesRepository['normalizeVoteRow']>[0]>(
      tenantId,
      `
      UPDATE group_votes
      SET status = 'closed', updated_at = now()
      WHERE id = $1 AND tenant_id = $2
      RETURNING ${VotesRepository.VOTE_COLS}
      `,
      [voteId, tenantId]
    );

    if (!row) {
      throw new Error('Votação não encontrada');
    }

    return toGroupVote(this.normalizeVoteRow(row));
  }

  async getVoteResponseCount(tenantId: string, voteId: string): Promise<number> {
    const row = await this.one<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM group_vote_responses
      WHERE vote_id = $1 AND tenant_id = $2
      `,
      [voteId, tenantId]
    );

    return row ? parseInt(row.count, 10) : 0;
  }
}

export const votesRepository = new VotesRepository();
