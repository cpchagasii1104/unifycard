// backend/src/core/pilot/pilot-hypotheses.repository.ts
// SPRINT 16: Repository para hipóteses de interpretação humana

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface PilotHypothesis {
  hypothesisId: string;
  tenantId: string;
  content: string;
  createdByUserId: string;
  createdAt: Date;
}

export interface CreateHypothesisInput {
  content: string;
}

class PilotHypothesesRepository {
  /**
   * Cria uma nova hipótese
   */
  async create(
    tenantId: string,
    input: CreateHypothesisInput,
    createdByUserId: string
  ): Promise<PilotHypothesis> {
    const result = await runQueryWithTenant<{
      hypothesis_id: string;
      tenant_id: string;
      content: string;
      created_by_user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO pilot_hypotheses (
          tenant_id, content, created_by_user_id
        )
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [tenantId, input.content.trim(), createdByUserId]
    );

    if (!result) throw new Error('create: INSERT did not return row');
    return {
      hypothesisId: result.hypothesis_id,
      tenantId: result.tenant_id,
      content: result.content,
      createdByUserId: result.created_by_user_id,
      createdAt: result.created_at,
    };
  }

  /**
   * Lista hipóteses
   */
  async list(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<PilotHypothesis[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const rows = await runQueriesWithTenant<{
      hypothesis_id: string;
      tenant_id: string;
      content: string;
      created_by_user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM pilot_hypotheses
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        OFFSET $3
      `,
      [tenantId, limit, offset]
    );

    return rows.map((row) => ({
      hypothesisId: row.hypothesis_id,
      tenantId: row.tenant_id,
      content: row.content,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }));
  }

  /**
   * Deleta uma hipótese
   */
  async delete(
    tenantId: string,
    hypothesisId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
        DELETE FROM pilot_hypotheses
        WHERE tenant_id = $1
          AND hypothesis_id = $2
        RETURNING COUNT(*) as count
      `,
      [tenantId, hypothesisId]
    );

    return parseInt(result?.count ?? '0', 10) > 0;
  }
}

export const pilotHypothesesRepository = new PilotHypothesesRepository();








