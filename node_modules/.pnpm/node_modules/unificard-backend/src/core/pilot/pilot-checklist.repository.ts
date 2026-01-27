// backend/src/core/pilot/pilot-checklist.repository.ts
// SPRINT 15: Repository para checklist de observação humana

import { runQueryWithTenant } from '@core/database/pool';

export interface PilotChecklistItem {
  checklistId: string;
  tenantId: string;
  observedUserId: string;
  itemKey: string;
  itemLabel: string;
  checked: boolean;
  checkedByUserId?: string;
  checkedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChecklistItemInput {
  observedUserId: string;
  itemKey: string;
  itemLabel: string;
}

export interface UpdateChecklistItemInput {
  checked: boolean;
  checkedByUserId: string;
}

class PilotChecklistRepository {
  /**
   * Cria ou atualiza item do checklist
   */
  async upsertItem(
    tenantId: string,
    input: CreateChecklistItemInput,
    updateInput: UpdateChecklistItemInput
  ): Promise<PilotChecklistItem> {
    const result = await runQueryWithTenant<{
      checklist_id: string;
      tenant_id: string;
      observed_user_id: string;
      item_key: string;
      item_label: string;
      checked: boolean;
      checked_by_user_id: string | null;
      checked_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO pilot_checklist (
          tenant_id, observed_user_id, item_key, item_label,
          checked, checked_by_user_id, checked_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 THEN NOW() ELSE NULL END)
        ON CONFLICT (tenant_id, observed_user_id, item_key)
        DO UPDATE SET
          checked = $5,
          checked_by_user_id = $6,
          checked_at = CASE WHEN $5 THEN NOW() ELSE NULL END,
          updated_at = NOW()
        RETURNING *
      `,
      [
        tenantId,
        input.observedUserId,
        input.itemKey,
        input.itemLabel,
        updateInput.checked,
        updateInput.checkedByUserId || null,
      ]
    );

    const row = result[0];
    return {
      checklistId: row.checklist_id,
      tenantId: row.tenant_id,
      observedUserId: row.observed_user_id,
      itemKey: row.item_key,
      itemLabel: row.item_label,
      checked: row.checked,
      checkedByUserId: row.checked_by_user_id || undefined,
      checkedAt: row.checked_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Lista itens do checklist para um usuário
   */
  async listByUser(
    tenantId: string,
    observedUserId: string
  ): Promise<PilotChecklistItem[]> {
    const result = await runQueryWithTenant<{
      checklist_id: string;
      tenant_id: string;
      observed_user_id: string;
      item_key: string;
      item_label: string;
      checked: boolean;
      checked_by_user_id: string | null;
      checked_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM pilot_checklist
        WHERE tenant_id = $1
          AND observed_user_id = $2
        ORDER BY item_key
      `,
      [tenantId, observedUserId]
    );

    return result.map((row) => ({
      checklistId: row.checklist_id,
      tenantId: row.tenant_id,
      observedUserId: row.observed_user_id,
      itemKey: row.item_key,
      itemLabel: row.item_label,
      checked: row.checked,
      checkedByUserId: row.checked_by_user_id || undefined,
      checkedAt: row.checked_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Lista todos os usuários com checklist
   */
  async listUsers(tenantId: string): Promise<string[]> {
    const result = await runQueryWithTenant<{ observed_user_id: string }>(
      tenantId,
      `
        SELECT DISTINCT observed_user_id
        FROM pilot_checklist
        WHERE tenant_id = $1
        ORDER BY observed_user_id
      `,
      [tenantId]
    );

    return result.map((row) => row.observed_user_id);
  }
}

export const pilotChecklistRepository = new PilotChecklistRepository();







