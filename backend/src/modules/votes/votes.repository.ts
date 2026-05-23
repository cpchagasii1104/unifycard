// src/modules/votes/votes.repository.ts
// Repository para operações de banco de dados relacionadas a votações

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

/** Colunas como retornadas pelo PostgreSQL */
interface VoteRowDb {
  vote_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  created_by_actor_id: string;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface VoteOptionRowDb {
  option_id: string;
  vote_id: string;
  label: string;
  created_at: Date;
}

interface VoteResponseRowDb {
  response_id: string;
  vote_id: string;
  vote_option_id: string;
  actor_id: string;
  created_at: Date;
}

export interface VoteRow {
  vote_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'closed';
  created_by_actor_id: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoteOptionRow {
  option_id: string;
  vote_id: string;
  label: string;
  createdAt: string;
}

export interface VoteResponseRow {
  response_id: string;
  vote_id: string;
  vote_option_id: string;
  actor_id: string;
  createdAt: string;
}

function toVote(row: VoteRowDb): VoteRow {
  return {
    vote_id: row.vote_id,
    tenant_id: row.tenant_id,
    title: row.title,
    description: row.description,
    status: row.status,
    created_by_actor_id: row.created_by_actor_id,
    startsAt: row.starts_at ? row.starts_at.toISOString() : null,
    endsAt: row.ends_at ? row.ends_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toOption(row: VoteOptionRowDb): VoteOptionRow {
  return {
    option_id: row.option_id,
    vote_id: row.vote_id,
    label: row.label,
    createdAt: row.created_at.toISOString(),
  };
}

function toResponse(row: VoteResponseRowDb): VoteResponseRow {
  return {
    response_id: row.response_id,
    vote_id: row.vote_id,
    vote_option_id: row.vote_option_id,
    actor_id: row.actor_id,
    createdAt: row.created_at.toISOString(),
  };
}

export class VotesRepository {
  /**
   * Cria uma nova votação
   */
  async create(
    tenantId: string,
    data: {
      title: string;
      description?: string;
      created_by_actor_id: string;
      startsAt?: string;
      endsAt?: string;
    }
  ): Promise<VoteRow> {
    const row = await runQueryWithTenant<VoteRowDb>(
      tenantId,
      `
      INSERT INTO votes (
        tenant_id, title, description, status, created_by_actor_id, starts_at, ends_at
      )
      VALUES ($1, $2, $3, 'draft', $4, $5, $6)
      RETURNING vote_id, tenant_id, title, description, status, created_by_actor_id, starts_at, ends_at, created_at, updated_at
      `,
      [
        tenantId,
        data.title,
        data.description || null,
        data.created_by_actor_id,
        data.startsAt || null,
        data.endsAt || null,
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar votação');
    }

    return toVote(row);
  }

  /**
   * Busca votação por ID
   */
  async findById(tenantId: string, voteId: string): Promise<VoteRow | null> {
    const row = await runQueryWithTenant<VoteRowDb>(
      tenantId,
      `
      SELECT vote_id, tenant_id, title, description, status, created_by_actor_id, starts_at, ends_at, created_at, updated_at
      FROM votes
      WHERE vote_id = $1 AND tenant_id = $2
      `,
      [voteId, tenantId]
    );

    return row ? toVote(row) : null;
  }

  /**
   * Lista votações (ativas e encerradas)
   */
  async list(
    tenantId: string,
    options: {
      status?: 'draft' | 'active' | 'closed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ rows: VoteRow[]; totalCents: number }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let whereClause = 'WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];

    if (options.status) {
      whereClause += ' AND status = $2';
      params.push(options.status);
    }

    const rows = await runQueriesWithTenant<VoteRowDb>(
      tenantId,
      `
      SELECT vote_id, tenant_id, title, description, status, created_by_actor_id, starts_at, ends_at, created_at, updated_at
      FROM votes
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      params
    );

    const totalResult = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM votes
      ${whereClause}
      `,
      params
    );

    return {
      rows: rows.map(toVote),
      totalCents: parseInt(totalResult?.count || '0', 10),
    };
  }

  /**
   * Atualiza status da votação
   */
  async updateStatus(
    tenantId: string,
    voteId: string,
    status: 'draft' | 'active' | 'closed'
  ): Promise<VoteRow> {
    const row = await runQueryWithTenant<VoteRowDb>(
      tenantId,
      `
      UPDATE votes
      SET status = $1, updated_at = now()
      WHERE vote_id = $2 AND tenant_id = $3
      RETURNING vote_id, tenant_id, title, description, status, created_by_actor_id, starts_at, ends_at, created_at, updated_at
      `,
      [status, voteId, tenantId]
    );

    if (!row) {
      throw new Error('Votação não encontrada');
    }

    return toVote(row);
  }

  /**
   * Adiciona opção à votação
   */
  async addOption(tenantId: string, voteId: string, label: string): Promise<VoteOptionRow> {
    const row = await runQueryWithTenant<VoteOptionRowDb>(
      tenantId,
      `
      INSERT INTO vote_options (vote_id, label)
      VALUES ($1, $2)
      RETURNING option_id, vote_id, label, created_at
      `,
      [voteId, label]
    );

    if (!row) {
      throw new Error('Falha ao adicionar opção');
    }

    return toOption(row);
  }

  /**
   * Busca opções de uma votação
   */
  async getOptions(tenantId: string, voteId: string): Promise<VoteOptionRow[]> {
    const rows = await runQueriesWithTenant<VoteOptionRowDb>(
      tenantId,
      `
      SELECT vo.option_id, vo.vote_id, vo.label, vo.created_at
      FROM vote_options vo
      INNER JOIN votes v ON v.vote_id = vo.vote_id
      WHERE vo.vote_id = $1 AND v.tenant_id = $2
      ORDER BY vo.created_at ASC
      `,
      [voteId, tenantId]
    );

    return rows.map(toOption);
  }

  /**
   * Registra voto
   */
  async addResponse(
    tenantId: string,
    data: {
      vote_id: string;
      vote_option_id: string;
      actor_id: string;
    }
  ): Promise<VoteResponseRow> {
    const existing = await runQueryWithTenant<VoteResponseRowDb>(
      tenantId,
      `
      SELECT vr.response_id, vr.vote_id, vr.vote_option_id, vr.actor_id, vr.created_at
      FROM vote_responses vr
      INNER JOIN votes v ON v.vote_id = vr.vote_id
      WHERE vr.vote_id = $1 AND vr.actor_id = $2 AND v.tenant_id = $3
      `,
      [data.vote_id, data.actor_id, tenantId]
    );

    if (existing) {
      throw new Error('Você já votou nesta votação');
    }

    const row = await runQueryWithTenant<VoteResponseRowDb>(
      tenantId,
      `
      INSERT INTO vote_responses (vote_id, vote_option_id, actor_id)
      VALUES ($1, $2, $3)
      RETURNING response_id, vote_id, vote_option_id, actor_id, created_at
      `,
      [data.vote_id, data.vote_option_id, data.actor_id]
    );

    if (!row) {
      throw new Error('Falha ao registrar voto');
    }

    return toResponse(row);
  }

  /**
   * Busca resultados agregados de uma votação
   */
  async getResults(
    tenantId: string,
    voteId: string
  ): Promise<
    Array<{
      option_id: string;
      label: string;
      count: number;
      percentage: number;
    }>
  > {
    const results = await runQueriesWithTenant<{
      option_id: string;
      label: string;
      count: string;
      totalCents: string;
    }>(
      tenantId,
      `
      SELECT 
        vo.option_id,
        vo.label,
        COUNT(vr.response_id)::text as count,
        (SELECT COUNT(*)::text FROM vote_responses WHERE vote_id = $1) as "totalCents"
      FROM vote_options vo
      LEFT JOIN vote_responses vr ON vr.vote_option_id = vo.option_id
      INNER JOIN votes v ON v.vote_id = vo.vote_id
      WHERE vo.vote_id = $1 AND v.tenant_id = $2
      GROUP BY vo.option_id, vo.label
      ORDER BY vo.created_at ASC
      `,
      [voteId, tenantId]
    );

    if (!results || results.length === 0) {
      return [];
    }

    const total = parseInt(results[0]?.totalCents || '0', 10);

    return results.map((r) => ({
      option_id: r.option_id,
      label: r.label,
      count: parseInt(r.count || '0', 10),
      percentage: total > 0 ? (parseInt(r.count || '0', 10) / total) * 100 : 0,
    }));
  }

  /**
   * Verifica se actor já votou
   */
  async hasVoted(tenantId: string, voteId: string, actorId: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      `
      SELECT EXISTS(
        SELECT 1
        FROM vote_responses vr
        INNER JOIN votes v ON v.vote_id = vr.vote_id
        WHERE vr.vote_id = $1 AND vr.actor_id = $2 AND v.tenant_id = $3
      ) as exists
      `,
      [voteId, actorId, tenantId]
    );

    return result?.exists || false;
  }
}

export const votesRepository = new VotesRepository();
