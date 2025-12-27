// src/modules/social-actions/social-actions.repository.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { SocialActionRow } from './social-actions.types';

export class SocialActionsRepository {
  /**
   * Busca ação por ID
   */
  async findById(tenantId: string, actionId: string): Promise<SocialActionRow | null> {
    const row = await runQueryWithTenant<SocialActionRow>(
      tenantId,
      `
      SELECT action_id, post_id, tenant_id, global_user_id, intent, confidence, parameters, status, execution_result, created_at, executed_at
      FROM social_actions
      WHERE action_id = $1
      LIMIT 1
      `,
      [actionId]
    );

    return row || null;
  }

  /**
   * Cria uma nova ação
   */
  async create(data: {
    postId: string;
    tenantId: string;
    globalUserId: string;
    intent: string;
    confidence: number | null;
    parameters: Record<string, any>;
  }): Promise<SocialActionRow> {
    const row = await runQueryWithTenant<SocialActionRow>(
      data.tenantId,
      `
      INSERT INTO social_actions (
        post_id,
        tenant_id,
        global_user_id,
        intent,
        confidence,
        parameters
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING action_id, post_id, tenant_id, global_user_id, intent, confidence, parameters, status, execution_result, created_at, executed_at
      `,
      [
        data.postId,
        data.tenantId,
        data.globalUserId,
        data.intent,
        data.confidence,
        JSON.stringify(data.parameters),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar ação');
    }

    return row;
  }

  /**
   * Atualiza status e resultado de execução
   */
  async updateExecution(
    tenantId: string,
    actionId: string,
    status: 'executed' | 'failed' | 'cancelled',
    executionResult: Record<string, any> | null
  ): Promise<SocialActionRow | null> {
    const row = await runQueryWithTenant<SocialActionRow>(
      tenantId,
      `
      UPDATE social_actions
      SET status = $1,
          execution_result = $2,
          executed_at = now()
      WHERE action_id = $3
      RETURNING action_id, post_id, tenant_id, global_user_id, intent, confidence, parameters, status, execution_result, created_at, executed_at
      `,
      [status, JSON.stringify(executionResult), actionId]
    );

    return row || null;
  }

  /**
   * Busca ações por post
   */
  async findByPost(tenantId: string, postId: string): Promise<SocialActionRow[]> {
    const rows = await runQueriesWithTenant<SocialActionRow>(
      tenantId,
      `
      SELECT action_id, post_id, tenant_id, global_user_id, intent, confidence, parameters, status, execution_result, created_at, executed_at
      FROM social_actions
      WHERE post_id = $1
      ORDER BY created_at DESC
      `,
      [postId]
    );

    return rows;
  }

  /**
   * Busca ações por usuário
   */
  async findByUser(
    tenantId: string,
    globalUserId: string,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<SocialActionRow[]> {
    const { limit = 50, offset = 0, status } = options;

    let query = `
      SELECT action_id, post_id, tenant_id, global_user_id, intent, confidence, parameters, status, execution_result, created_at, executed_at
      FROM social_actions
      WHERE global_user_id = $1
    `;

    const params: any[] = [globalUserId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<SocialActionRow>(tenantId, query, params);

    return rows;
  }
}

