// backend/src/core/pilot/pilot-notes.repository.ts
// SPRINT 15: Repository para notas de observação humana

import { runQueryWithTenant } from '@core/database/pool';

export interface PilotNote {
  noteId: string;
  tenantId: string;
  observedUserId: string;
  content: string;
  createdByUserId: string;
  createdAt: Date;
}

export interface CreateNoteInput {
  observedUserId: string;
  content: string;
}

class PilotNotesRepository {
  /**
   * Cria uma nova nota
   */
  async create(
    tenantId: string,
    input: CreateNoteInput,
    createdByUserId: string
  ): Promise<PilotNote> {
    const result = await runQueryWithTenant<{
      note_id: string;
      tenant_id: string;
      observed_user_id: string;
      content: string;
      created_by_user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO pilot_notes (
          tenant_id, observed_user_id, content, created_by_user_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [tenantId, input.observedUserId, input.content.trim(), createdByUserId]
    );

    const row = result[0];
    return {
      noteId: row.note_id,
      tenantId: row.tenant_id,
      observedUserId: row.observed_user_id,
      content: row.content,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Lista notas de um usuário
   */
  async listByUser(
    tenantId: string,
    observedUserId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<PilotNote[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const result = await runQueryWithTenant<{
      note_id: string;
      tenant_id: string;
      observed_user_id: string;
      content: string;
      created_by_user_id: string;
      created_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM pilot_notes
        WHERE tenant_id = $1
          AND observed_user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
        OFFSET $4
      `,
      [tenantId, observedUserId, limit, offset]
    );

    return result.map((row) => ({
      noteId: row.note_id,
      tenantId: row.tenant_id,
      observedUserId: row.observed_user_id,
      content: row.content,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }));
  }

  /**
   * Deleta uma nota
   */
  async delete(
    tenantId: string,
    noteId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
        DELETE FROM pilot_notes
        WHERE tenant_id = $1
          AND note_id = $2
        RETURNING COUNT(*) as count
      `,
      [tenantId, noteId]
    );

    return parseInt(result[0]?.count || '0', 10) > 0;
  }
}

export const pilotNotesRepository = new PilotNotesRepository();







