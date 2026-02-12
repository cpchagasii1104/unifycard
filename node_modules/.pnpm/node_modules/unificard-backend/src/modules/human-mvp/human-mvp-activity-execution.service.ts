// backend/src/modules/human-mvp/human-mvp-activity-execution.service.ts
// Service para Execução de Atividades do Human MVP
// COMMIT 6: Registrar execução de atividade

import { pool } from '@core/database/pool';
import { tenantContextPermissionService } from '@core/tenants/tenant-context-permission.service';
import type { CategoryContext } from '@unificard/contracts';

export interface RegisterActivityExecutionInput {
  eventInstanceId: string;
}

export interface ActivityExecutedEvent {
  tenantId: string;
  eventInstanceId: string;
  opportunityId: string;
  personId: string;
  categoryId: string;
  context: CategoryContext;
  executedAt: Date;
  timestamp: Date;
}

class HumanMvpActivityExecutionService {
  /**
   * Registra a execução de uma atividade
   * Validações obrigatórias:
   * - EventInstance existe
   * - EventInstance ainda não foi executado
   * - Context é válido
   * - Tenant tem permissão de write no context
   * - Execução só pode ocorrer UMA vez por EventInstance
   */
  async registerExecution(
    input: RegisterActivityExecutionInput,
    tenantId: string
  ): Promise<{ executionId: string }> {
    // VALIDAÇÃO 1: EventInstance existe
    const eventInstanceResult = await pool.query<{
      id: string;
      tenant_id: string;
      opportunity_id: string;
      person_id: string;
      category_id: string;
      context: CategoryContext;
      executedAt: Date | null;
    }>(
      `
      SELECT id, tenant_id, opportunity_id, person_id, category_id, context, executedAt
      FROM human_mvp_event_instances
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [input.eventInstanceId, tenantId]
    );

    if (eventInstanceResult.rows.length === 0) {
      throw new Error('EventInstance não encontrado');
    }

    const eventInstance = eventInstanceResult.rows[0];

    // VALIDAÇÃO 2: EventInstance ainda não foi executado
    if (eventInstance.executedAt !== null) {
      throw new Error('EventInstance já foi executado');
    }

    // VALIDAÇÃO 3: Context é válido
    const context = eventInstance.context;
    const allowedContexts: CategoryContext[] = ['professional', 'person', 'interest'];
    if (!allowedContexts.includes(context)) {
      throw new Error('Context inválido');
    }

    // VALIDAÇÃO 4: Tenant tem permissão de write no context
    const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
      tenantId,
      context
    );
    if (!hasWriteAccess) {
      throw new Error(`CONTEXT_ACCESS_DENIED: Tenant ${tenantId} não tem permissão de escrita no context ${context}`);
    }

    // Registrar execução (atualizar executedAt)
    const executedAt = new Date();
    const result = await pool.query<{ id: string }>(
      `
      UPDATE human_mvp_event_instances
      SET executedAt = $1, updatedAt = NOW()
      WHERE id = $2
        AND tenant_id = $3
        AND executedAt IS NULL
      RETURNING id
      `,
      [executedAt, input.eventInstanceId, tenantId]
    );

    if (result.rows.length === 0) {
      // Pode ter sido executado entre a validação e a atualização (race condition)
      throw new Error('EventInstance já foi executado');
    }

    const executionId = result.rows[0].id;

    // Gerar e persistir evento ACTIVITY_EXECUTED
    await this.recordActivityExecutedEvent({
      tenantId,
      eventInstanceId: input.eventInstanceId,
      opportunityId: eventInstance.opportunity_id,
      personId: eventInstance.person_id,
      categoryId: eventInstance.category_id,
      context,
      executedAt,
      timestamp: new Date(),
    });

    return { executionId };
  }

  /**
   * Registra evento ACTIVITY_EXECUTED
   */
  private async recordActivityExecutedEvent(event: ActivityExecutedEvent): Promise<void> {
    await pool.query(
      `
      INSERT INTO human_mvp_events (
        event_type, tenant_id, person_id, category_id, context, details, createdAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        'ACTIVITY_EXECUTED',
        event.tenantId,
        event.personId,
        event.categoryId,
        event.context,
        JSON.stringify({
          eventInstanceId: event.eventInstanceId,
          opportunityId: event.opportunityId,
          executedAt: event.executedAt.toISOString(),
        }),
        event.timestamp,
      ]
    );
  }
}

export const humanMvpActivityExecutionService = new HumanMvpActivityExecutionService();





