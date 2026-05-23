// src/modules/groups/votes.repository.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  GroupVote,
  GroupVoteOption,
  GroupVoteResponse,
  CreateVoteInput,
  VoteOptionWithCount,
} from './votes.types';
import { toGroupVote, toGroupVoteOption, toGroupVoteResponse } from './votes.types';

class VotesRepository {
  private normalizeVoteRow(row: {
    vote_id: string;
    tenant_id: string;
    group_id: string;
    created_by_user_id: string;
    title: string;
    description: string | null;
    status: string;
    closes_at: Date | null;
    created_at: Date | string;
    updated_at: Date | string;
  }): Parameters<typeof toGroupVote>[0] {
    return {
      vote_id: row.vote_id,
      tenant_id: row.tenant_id,
      group_id: row.group_id,
      created_by_user_id: row.created_by_user_id,
      title: row.title,
      description: row.description,
      status: row.status,
      closesAt: row.closes_at,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private normalizeVoteOptionRow(row: {
    option_id: string;
    vote_id: string;
    tenant_id: string;
    text: string;
    display_order: number;
    created_at: Date | string;
  }): Parameters<typeof toGroupVoteOption>[0] {
    return {
      option_id: row.option_id,
      vote_id: row.vote_id,
      tenant_id: row.tenant_id,
      text: row.text,
      display_order: row.display_order,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private normalizeVoteResponseRow(row: {
    response_id: string;
    vote_id: string;
    option_id: string;
    tenant_id: string;
    user_id: string;
    created_at: Date | string;
  }): Parameters<typeof toGroupVoteResponse>[0] {
    return {
      response_id: row.response_id,
      vote_id: row.vote_id,
      option_id: row.option_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  async createVote(
    tenantId: string,
    groupId: string,
    createdByUserId: string,
    input: CreateVoteInput
  ): Promise<GroupVote> {
    const row = await runQueryWithTenant<{
      vote_id: string;
      tenant_id: string;
      group_id: string;
      created_by_user_id: string;
      title: string;
      description: string | null;
      status: string;
      closes_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO group_votes (
        tenant_id, group_id, created_by_user_id, title, description, status, closes_at
      )
      VALUES ($1, $2, $3, $4, $5, 'open', $6)
      RETURNING vote_id, tenant_id, group_id, created_by_user_id, title, description, status, closes_at, created_at, updated_at
      `,
      [
        tenantId,
        groupId,
        createdByUserId,
        input.title,
        input.description ?? null,
        input.closesAt ? new Date(input.closesAt) : null,
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar votação');
    }

    return toGroupVote(this.normalizeVoteRow(row));
  }

  async createVoteOptions(
    tenantId: string,
    voteId: string,
    options: string[]
  ): Promise<GroupVoteOption[]> {
    const createdOptions: GroupVoteOption[] = [];

    for (let i = 0; i < options.length; i++) {
      const row = await runQueryWithTenant<{
        option_id: string;
        vote_id: string;
        tenant_id: string;
        text: string;
        display_order: number;
        created_at: Date;
      }>(
        tenantId,
        `
        INSERT INTO group_vote_options (
          vote_id, tenant_id, text, display_order
        )
        VALUES ($1, $2, $3, $4)
        RETURNING option_id, vote_id, tenant_id, text, display_order, created_at
        `,
        [voteId, tenantId, options[i], i]
      );

      if (row) {
        createdOptions.push(toGroupVoteOption(this.normalizeVoteOptionRow(row)));
      }
    }

    return createdOptions;
  }

  async getVote(tenantId: string, voteId: string): Promise<GroupVote | null> {
    const row = await runQueryWithTenant<{
      vote_id: string;
      tenant_id: string;
      group_id: string;
      created_by_user_id: string;
      title: string;
      description: string | null;
      status: string;
      closes_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      SELECT vote_id, tenant_id, group_id, created_by_user_id, title, description, status, closes_at, created_at, updated_at
      FROM group_votes
      WHERE vote_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [voteId, tenantId]
    );

    return row ? toGroupVote(this.normalizeVoteRow(row)) : null;
  }

  async getVoteOptions(tenantId: string, voteId: string): Promise<GroupVoteOption[]> {
    const rows = await runQueriesWithTenant<{
      option_id: string;
      vote_id: string;
      tenant_id: string;
      text: string;
      display_order: number;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT option_id, vote_id, tenant_id, text, display_order, created_at
      FROM group_vote_options
      WHERE vote_id = $1 AND tenant_id = $2
      ORDER BY display_order ASC
      `,
      [voteId, tenantId]
    );

    return rows.map((r) => toGroupVoteOption(this.normalizeVoteOptionRow(r)));
  }

  async getVoteCounts(tenantId: string, voteId: string): Promise<Map<string, number>> {
    const rows = await runQueriesWithTenant<{
      option_id: string;
      vote_count: string;
    }>(
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

  async getUserVote(tenantId: string, voteId: string, userId: string): Promise<GroupVoteResponse | null> {
    const row = await runQueryWithTenant<{
      response_id: string;
      vote_id: string;
      option_id: string;
      tenant_id: string;
      user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT response_id, vote_id, option_id, tenant_id, user_id, created_at
      FROM group_vote_responses
      WHERE vote_id = $1 AND tenant_id = $2 AND user_id = $3
      LIMIT 1
      `,
      [voteId, tenantId, userId]
    );

    return row ? toGroupVoteResponse(this.normalizeVoteResponseRow(row)) : null;
  }

  async createVoteResponse(
    tenantId: string,
    voteId: string,
    optionId: string,
    userId: string
  ): Promise<GroupVoteResponse> {
    const row = await runQueryWithTenant<{
      response_id: string;
      vote_id: string;
      option_id: string;
      tenant_id: string;
      user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
      INSERT INTO group_vote_responses (
        vote_id, option_id, tenant_id, user_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING response_id, vote_id, option_id, tenant_id, user_id, created_at
      `,
      [voteId, optionId, tenantId, userId]
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
      SELECT vote_id, tenant_id, group_id, created_by_user_id, title, description, status, closes_at, created_at, updated_at
      FROM group_votes
      WHERE group_id = $1 AND tenant_id = $2
    `;
    const params: (string | number)[] = [groupId, tenantId];

    if (status) {
      query += ` AND status = $3`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = await runQueriesWithTenant<{
      vote_id: string;
      tenant_id: string;
      group_id: string;
      created_by_user_id: string;
      title: string;
      description: string | null;
      status: string;
      closes_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(tenantId, query, params);

    return rows.map((r) => toGroupVote(this.normalizeVoteRow(r)));
  }

  async getVotersByOption(tenantId: string, voteId: string): Promise<Array<{
    optionId: string;
    userId: string;
    userName: string | null;
    createdAt: Date;
  }>> {
    const rows = await runQueriesWithTenant<{
      option_id: string;
      user_id: string;
      name: string | null;
      created_at: Date;
    }>(
      tenantId,
      `
      SELECT gvr.option_id, gvr.user_id, u.name, gvr.created_at
      FROM group_vote_responses gvr
      LEFT JOIN users u ON u.global_user_id = gvr.user_id AND u.tenant_id = $2
      WHERE gvr.vote_id = $1 AND gvr.tenant_id = $2
      ORDER BY gvr.option_id, gvr.created_at
      `,
      [voteId, tenantId]
    );

    return rows.map((row) => ({
      optionId: row.option_id,
      userId: row.user_id,
      userName: row.name || null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    }));
  }

  async closeVote(tenantId: string, voteId: string): Promise<GroupVote> {
    const row = await runQueryWithTenant<{
      vote_id: string;
      tenant_id: string;
      group_id: string;
      created_by_user_id: string;
      title: string;
      description: string | null;
      status: string;
      closes_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      UPDATE group_votes
      SET status = 'closed', updated_at = now()
      WHERE vote_id = $1 AND tenant_id = $2
      RETURNING vote_id, tenant_id, group_id, created_by_user_id, title, description, status, closes_at, created_at, updated_at
      `,
      [voteId, tenantId]
    );

    if (!row) {
      throw new Error('Votação não encontrada');
    }

    return toGroupVote(this.normalizeVoteRow(row));
  }

  async getVoteResponseCount(tenantId: string, voteId: string): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
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


