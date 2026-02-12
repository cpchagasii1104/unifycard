// src/modules/votes/votes.repository.ts
// Repository para operações de banco de dados relacionadas a votações

import { runQueryWithTenant } from '@core/database/pool';

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

export class VotesRepository {
  /**
   * Cria uma nova votação
   */
  async create(tenantId: string, data: {
    title: string;
    description?: string;
    created_by_actor_id: string;
    startsAt?: string;
    endsAt?: string;
  }): Promise<VoteRow> {
    const row = await runQueryWithTenant<VoteRow>(
      tenantId,
      `
      INSERT INTO votes (
        tenant_id, title, description, status, created_by_actor_id, startsAt, endsAt
      )
      VALUES ($1, $2, $3, 'draft', $4, $5, $6)
      RETURNING vote_id, tenant_id, title, description, status, created_by_actor_id, startsAt, endsAt, createdAt, updatedAt
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

    return row;
  }

  /**
   * Busca votação por ID
   */
  async findById(tenantId: string, voteId: string): Promise<VoteRow | null> {
    const row = await runQueryWithTenant<VoteRow>(
      tenantId,
      `
      SELECT vote_id, tenant_id, title, description, status, created_by_actor_id, startsAt, endsAt, createdAt, updatedAt
      FROM votes
      WHERE vote_id = $1 AND tenant_id = $2
      `,
      [voteId, tenantId]
    );

    return row || null;
  }

  /**
   * Lista votações (ativas e encerradas)
   */
  async list(tenantId: string, options: {
    status?: 'draft' | 'active' | 'closed';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ rows: VoteRow[]; totalCents: number }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    
    if (options.status) {
      whereClause += ' AND status = $2';
      params.push(options.status);
    }

    const rows = await runQueryWithTenant<VoteRow[]>(
      tenantId,
      `
      SELECT vote_id, tenant_id, title, description, status, created_by_actor_id, startsAt, endsAt, createdAt, updatedAt
      FROM votes
      ${whereClause}
      ORDER BY createdAt DESC
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
      rows: rows || [],
      totalCents: parseInt(totalResult?.count || '0', 10),
    };
  }

  /**
   * Atualiza status da votação
   */
  async updateStatus(tenantId: string, voteId: string, status: 'draft' | 'active' | 'closed'): Promise<VoteRow> {
    const row = await runQueryWithTenant<VoteRow>(
      tenantId,
      `
      UPDATE votes
      SET status = $1, updatedAt = now()
      WHERE vote_id = $2 AND tenant_id = $3
      RETURNING vote_id, tenant_id, title, description, status, created_by_actor_id, startsAt, endsAt, createdAt, updatedAt
      `,
      [status, voteId, tenantId]
    );

    if (!row) {
      throw new Error('Votação não encontrada');
    }

    return row;
  }

  /**
   * Adiciona opção à votação
   */
  async addOption(tenantId: string, voteId: string, label: string): Promise<VoteOptionRow> {
    const row = await runQueryWithTenant<VoteOptionRow>(
      tenantId,
      `
      INSERT INTO vote_options (vote_id, label)
      VALUES ($1, $2)
      RETURNING option_id, vote_id, label, createdAt
      `,
      [voteId, label]
    );

    if (!row) {
      throw new Error('Falha ao adicionar opção');
    }

    return row;
  }

  /**
   * Busca opções de uma votação
   */
  async getOptions(tenantId: string, voteId: string): Promise<VoteOptionRow[]> {
    const rows = await runQueryWithTenant<VoteOptionRow[]>(
      tenantId,
      `
      SELECT vo.option_id, vo.vote_id, vo.label, vo.createdAt
      FROM vote_options vo
      INNER JOIN votes v ON v.vote_id = vo.vote_id
      WHERE vo.vote_id = $1 AND v.tenant_id = $2
      ORDER BY vo.createdAt ASC
      `,
      [voteId, tenantId]
    );

    return rows || [];
  }

  /**
   * Registra voto
   */
  async addResponse(tenantId: string, data: {
    vote_id: string;
    vote_option_id: string;
    actor_id: string;
  }): Promise<VoteResponseRow> {
    // Verificar se já votou
    const existing = await runQueryWithTenant<VoteResponseRow>(
      tenantId,
      `
      SELECT vr.response_id, vr.vote_id, vr.vote_option_id, vr.actor_id, vr.createdAt
      FROM vote_responses vr
      INNER JOIN votes v ON v.vote_id = vr.vote_id
      WHERE vr.vote_id = $1 AND vr.actor_id = $2 AND v.tenant_id = $3
      `,
      [data.vote_id, data.actor_id, tenantId]
    );

    if (existing) {
      throw new Error('Você já votou nesta votação');
    }

    const row = await runQueryWithTenant<VoteResponseRow>(
      tenantId,
      `
      INSERT INTO vote_responses (vote_id, vote_option_id, actor_id)
      VALUES ($1, $2, $3)
      RETURNING response_id, vote_id, vote_option_id, actor_id, createdAt
      `,
      [data.vote_id, data.vote_option_id, data.actor_id]
    );

    if (!row) {
      throw new Error('Falha ao registrar voto');
    }

    return row;
  }

  /**
   * Busca resultados agregados de uma votação
   */
  async getResults(tenantId: string, voteId: string): Promise<Array<{
    option_id: string;
    label: string;
    count: number;
    percentage: number;
  }>> {
    const results = await runQueryWithTenant<Array<{
      option_id: string;
      label: string;
      count: string;
      totalCents: string;
    }>>(
      tenantId,
      `
      SELECT 
        vo.option_id,
        vo.label,
        COUNT(vr.response_id)::text as count,
        (SELECT COUNT(*)::text FROM vote_responses WHERE vote_id = $1) as total
      FROM vote_options vo
      LEFT JOIN vote_responses vr ON vr.vote_option_id = vo.option_id
      INNER JOIN votes v ON v.vote_id = vo.vote_id
      WHERE vo.vote_id = $1 AND v.tenant_id = $2
      GROUP BY vo.option_id, vo.label
      ORDER BY vo.createdAt ASC
      `,
      [voteId, tenantId]
    );

    if (!results || results.length === 0) {
      return [];
    }

    const total = parseInt(results[0]?.total || '0', 10);

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























