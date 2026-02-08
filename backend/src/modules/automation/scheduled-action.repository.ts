// backend/src/modules/automation/scheduled-action.repository.ts
// SPRINT 67: Repository para scheduled_actions

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ScheduledAction,
  ScheduledActionType,
  ScheduledActionStatus,
  ScheduledActionFilters,
} from './scheduled-action.types';

interface ScheduledActionRow {
  id: string;
  tenant_id: string;
  action_type: ScheduledActionType;
  reference_type: string;
  reference_id: string;
  scheduled_for: Date;
  status: ScheduledActionStatus;
  policy_snapshot: any;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  executedAt: Date | null;
  execution_error_code: string | null;
  execution_error_message: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class ScheduledActionRepository {
  /**
   * Converte row para ScheduledAction
   */
  private toScheduledAction(row: ScheduledActionRow): ScheduledAction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actionType: row.action_type,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      scheduledFor: row.scheduled_for,
      status: row.status,
      policySnapshot: row.policy_snapshot,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      executedAt: row.executedAt,
      executionErrorCode: row.execution_error_code,
      executionErrorMessage: row.execution_error_message,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria ação programada
   */
  async createAction(
    tenantId: string,
    input: {
      actionType: ScheduledActionType;
      referenceType: string;
      referenceId: string;
      scheduledFor: Date;
      policySnapshot: Record<string, any> | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata?: Record<string, any>;
    }
  ): Promise<ScheduledAction> {
    const row = await runQueryWithTenant<ScheduledActionRow>(
      tenantId,
      `
      INSERT INTO scheduled_actions (
        tenant_id, action_type, reference_type, reference_id,
        scheduled_for, status, policy_snapshot,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id, tenant_id, action_type, reference_type, reference_id,
                scheduled_for, status, policy_snapshot,
                created_by_actor_id, created_by_user_id,
                executedAt, execution_error_code, execution_error_message,
                metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.actionType,
        input.referenceType,
        input.referenceId,
        input.scheduledFor,
        'SCHEDULED',
        input.policySnapshot ? JSON.stringify(input.policySnapshot) : null,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar ação programada');
    }

    return this.toScheduledAction(row);
  }

  /**
   * Busca ação por ID
   */
  async getActionById(tenantId: string, actionId: string): Promise<ScheduledAction | null> {
    const rows = await runQueriesWithTenant<ScheduledActionRow>(
      tenantId,
      `
      SELECT id, tenant_id, action_type, reference_type, reference_id,
             scheduled_for, status, policy_snapshot,
             created_by_actor_id, created_by_user_id,
             executedAt, execution_error_code, execution_error_message,
             metadata, createdAt, updatedAt
      FROM scheduled_actions
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, actionId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toScheduledAction(rows[0]);
  }

  /**
   * Busca ações vencidas (scheduled_for <= now, status = SCHEDULED)
   */
  async getDueActions(tenantId: string, now: Date): Promise<ScheduledAction[]> {
    const rows = await runQueriesWithTenant<ScheduledActionRow>(
      tenantId,
      `
      SELECT id, tenant_id, action_type, reference_type, reference_id,
             scheduled_for, status, policy_snapshot,
             created_by_actor_id, created_by_user_id,
             executedAt, execution_error_code, execution_error_message,
             metadata, createdAt, updatedAt
      FROM scheduled_actions
      WHERE tenant_id = $1
        AND status = 'SCHEDULED'
        AND scheduled_for <= $2
      ORDER BY scheduled_for ASC
      `,
      [tenantId, now]
    );

    return rows.map((row) => this.toScheduledAction(row));
  }

  /**
   * Lista ações com filtros
   */
  async listActions(
    tenantId: string,
    filters: ScheduledActionFilters = {}
  ): Promise<ScheduledAction[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actionType) {
      conditions.push(`action_type = $${paramIndex}`);
      params.push(filters.actionType);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.referenceType) {
      conditions.push(`reference_type = $${paramIndex}`);
      params.push(filters.referenceType);
      paramIndex++;
    }

    if (filters.referenceId) {
      conditions.push(`reference_id = $${paramIndex}`);
      params.push(filters.referenceId);
      paramIndex++;
    }

    if (filters.scheduledForFrom) {
      conditions.push(`scheduled_for >= $${paramIndex}`);
      params.push(filters.scheduledForFrom);
      paramIndex++;
    }

    if (filters.scheduledForTo) {
      conditions.push(`scheduled_for <= $${paramIndex}`);
      params.push(filters.scheduledForTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<ScheduledActionRow>(
      tenantId,
      `
      SELECT id, tenant_id, action_type, reference_type, reference_id,
             scheduled_for, status, policy_snapshot,
             created_by_actor_id, created_by_user_id,
             executedAt, execution_error_code, execution_error_message,
             metadata, createdAt, updatedAt
      FROM scheduled_actions
      WHERE ${conditions.join(' AND ')}
      ORDER BY scheduled_for DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toScheduledAction(row));
  }

  /**
   * Cancela ação (apenas se status = SCHEDULED)
   */
  async cancelAction(tenantId: string, actionId: string): Promise<ScheduledAction> {
    const row = await runQueryWithTenant<ScheduledActionRow>(
      tenantId,
      `
      UPDATE scheduled_actions
      SET status = 'CANCELLED', updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'SCHEDULED'
      RETURNING id, tenant_id, action_type, reference_type, reference_id,
                scheduled_for, status, policy_snapshot,
                created_by_actor_id, created_by_user_id,
                executedAt, execution_error_code, execution_error_message,
                metadata, createdAt, updatedAt
      `,
      [tenantId, actionId]
    );

    if (!row) {
      throw new Error('Ação não encontrada ou já foi executada/cancelada');
    }

    return this.toScheduledAction(row);
  }

  /**
   * Marca ação como executada
   */
  async markAsExecuted(tenantId: string, actionId: string): Promise<ScheduledAction> {
    const row = await runQueryWithTenant<ScheduledActionRow>(
      tenantId,
      `
      UPDATE scheduled_actions
      SET status = 'EXECUTED', executedAt = NOW(), updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'SCHEDULED'
      RETURNING id, tenant_id, action_type, reference_type, reference_id,
                scheduled_for, status, policy_snapshot,
                created_by_actor_id, created_by_user_id,
                executedAt, execution_error_code, execution_error_message,
                metadata, createdAt, updatedAt
      `,
      [tenantId, actionId]
    );

    if (!row) {
      throw new Error('Ação não encontrada ou já foi executada/cancelada');
    }

    return this.toScheduledAction(row);
  }

  /**
   * Marca ação como falhada
   */
  async markAsFailed(
    tenantId: string,
    actionId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<ScheduledAction> {
    const row = await runQueryWithTenant<ScheduledActionRow>(
      tenantId,
      `
      UPDATE scheduled_actions
      SET status = 'FAILED', executedAt = NOW(),
          execution_error_code = $3, execution_error_message = $4,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'SCHEDULED'
      RETURNING id, tenant_id, action_type, reference_type, reference_id,
                scheduled_for, status, policy_snapshot,
                created_by_actor_id, created_by_user_id,
                executedAt, execution_error_code, execution_error_message,
                metadata, createdAt, updatedAt
      `,
      [tenantId, actionId, errorCode, errorMessage]
    );

    if (!row) {
      throw new Error('Ação não encontrada ou já foi executada/cancelada');
    }

    return this.toScheduledAction(row);
  }
}

export const scheduledActionRepository = new ScheduledActionRepository();









