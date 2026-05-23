// src/modules/social-actions/social-actions.model.ts
import type { SocialAction, SocialActionRow } from './social-actions.types';

export class SocialActionsModel {
  private static tsIso(v: string | Date): string {
    return v instanceof Date ? v.toISOString() : String(v);
  }

  static fromRow(row: SocialActionRow): SocialAction {
    return {
      actionId: row.action_id,
      postId: row.post_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      intent: row.intent,
      confidence: row.confidence ?? null,
      parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
      status: row.status as SocialAction['status'],
      executionResult: row.execution_result && typeof row.execution_result === 'object' ? row.execution_result : null,
      createdAt: this.tsIso(row.created_at),
      executedAt: row.executed_at ?? null,
    };
  }

  static fromRows(rows: SocialActionRow[]): SocialAction[] {
    return rows.map((row) => this.fromRow(row));
  }

  static toRow(action: Partial<SocialAction>): Partial<SocialActionRow> {
    const row: Partial<SocialActionRow> = {};

    if (action.actionId !== undefined) row.action_id = action.actionId;
    if (action.postId !== undefined) row.post_id = action.postId;
    if (action.tenantId !== undefined) row.tenant_id = action.tenantId;
    if (action.globalUserId !== undefined) row.global_user_id = action.globalUserId;
    if (action.intent !== undefined) row.intent = action.intent;
    if (action.confidence !== undefined) row.confidence = action.confidence ?? null;
    if (action.parameters !== undefined) row.parameters = action.parameters;
    if (action.status !== undefined) row.status = action.status;
    if (action.executionResult !== undefined) row.execution_result = action.executionResult ?? null;
    if (action.executedAt !== undefined) row.executed_at = action.executedAt ?? null;

    return row;
  }
}


















