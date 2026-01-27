// backend/src/modules/human-mvp/human-mvp-event-instance.service.ts
// Service para EventInstances do Human MVP
// COMMIT 5: Gerar EventInstance após MATCH_FOUND aceito

import { pool } from '@core/database/pool';
import { tenantContextPermissionService } from '@core/tenants/tenant-context-permission.service';
import type { CategoryContext } from '@unificard/contracts';

export interface CreateEventInstanceInput {
  matchFoundEventId: string; // ID do evento MATCH_FOUND
  matchedPersonId: string;
  scheduledAt: string; // ISO 8601 timestamp
}

export interface EventScheduledEvent {
  tenantId: string;
  opportunityId: string;
  personId: string;
  categoryId: string;
  context: CategoryContext;
  scheduledAt: Date;
  timestamp: Date;
}

class HumanMvpEventInstanceService {
  /**
   * Cria um EventInstance após MATCH_FOUND aceito
   * Validações obrigatórias:
   * - MATCH_FOUND existe
   * - matchedPersonId está na lista de matches
   * - Data/hora é válida e futura
   * - Context é válido
   * - Tenant tem permissão de write no context
   */
  async createEventInstance(
    input: CreateEventInstanceInput,
    tenantId: string
  ): Promise<{ eventInstanceId: string }> {
    // VALIDAÇÃO 1: MATCH_FOUND existe
    const matchEventResult = await pool.query<{
      id: string;
      tenant_id: string;
      category_id: string;
      context: CategoryContext;
      details: any;
    }>(
      `
      SELECT id, tenant_id, category_id, context, details
      FROM human_mvp_events
      WHERE id = $1
        AND event_type = 'MATCH_FOUND'
        AND tenant_id = $2
      LIMIT 1
      `,
      [input.matchFoundEventId, tenantId]
    );

    if (matchEventResult.rows.length === 0) {
      throw new Error('MATCH_FOUND não encontrado');
    }

    const matchEvent = matchEventResult.rows[0];
    const matchDetails = typeof matchEvent.details === 'string' 
      ? JSON.parse(matchEvent.details) 
      : matchEvent.details;

    // VALIDAÇÃO 2: matchedPersonId está na lista de matches
    const matchedPersonIds: string[] = matchDetails.matchedPersonIds || [];
    if (!matchedPersonIds.includes(input.matchedPersonId)) {
      throw new Error('matchedPersonId não está na lista de matches');
    }

    const opportunityId = matchDetails.opportunityId;
    if (!opportunityId) {
      throw new Error('opportunityId não encontrado no evento MATCH_FOUND');
    }

    // VALIDAÇÃO 3: Data/hora é válida e futura
    const scheduledAt = new Date(input.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new Error('Data/hora inválida');
    }

    const now = new Date();
    if (scheduledAt <= now) {
      throw new Error('Data/hora deve ser futura');
    }

    // VALIDAÇÃO 4: Context é válido
    const context = matchEvent.context;
    const allowedContexts: CategoryContext[] = ['professional', 'person', 'interest'];
    if (!allowedContexts.includes(context)) {
      throw new Error('Context inválido');
    }

    // VALIDAÇÃO 5: Tenant tem permissão de write no context
    const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
      tenantId,
      context
    );
    if (!hasWriteAccess) {
      throw new Error(`CONTEXT_ACCESS_DENIED: Tenant ${tenantId} não tem permissão de escrita no context ${context}`);
    }

    // VALIDAÇÃO 6: Opportunity existe
    const opportunityResult = await pool.query<{ id: string }>(
      `SELECT id FROM human_mvp_opportunities WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [opportunityId, tenantId]
    );

    if (opportunityResult.rows.length === 0) {
      throw new Error('Opportunity não encontrada');
    }

    // Criar EventInstance
    const result = await pool.query<{ id: string }>(
      `
      INSERT INTO human_mvp_event_instances (
        tenant_id, opportunity_id, person_id, category_id, context, scheduled_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
      `,
      [
        tenantId,
        opportunityId,
        input.matchedPersonId,
        matchEvent.category_id,
        context,
        scheduledAt,
      ]
    );

    const eventInstanceId = result.rows[0].id;

    // Gerar e persistir evento EVENT_SCHEDULED
    await this.recordEventScheduledEvent({
      tenantId,
      opportunityId,
      personId: input.matchedPersonId,
      categoryId: matchEvent.category_id,
      context,
      scheduledAt,
      timestamp: new Date(),
    });

    return { eventInstanceId };
  }

  /**
   * Registra evento EVENT_SCHEDULED
   */
  private async recordEventScheduledEvent(event: EventScheduledEvent): Promise<void> {
    await pool.query(
      `
      INSERT INTO human_mvp_events (
        event_type, tenant_id, person_id, category_id, context, details, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        'EVENT_SCHEDULED',
        event.tenantId,
        event.personId,
        event.categoryId,
        event.context,
        JSON.stringify({
          opportunityId: event.opportunityId,
          scheduledAt: event.scheduledAt.toISOString(),
        }),
        event.timestamp,
      ]
    );
  }
}

export const humanMvpEventInstanceService = new HumanMvpEventInstanceService();




