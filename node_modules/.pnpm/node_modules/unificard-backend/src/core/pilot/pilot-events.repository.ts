// backend/src/core/pilot/pilot-events.repository.ts
// SPRINT 13: Repository para eventos de observação do modo piloto

import { runQueryWithTenant } from '@core/database/pool';

export type PilotEventType =
  | 'first_action_executed'
  | 'first_company_created'
  | 'first_delegation'
  | 'first_dispute_opened'
  | 'first_transaction'
  | 'first_group_allocation'
  | 'first_workflow_completed'
  | 'first_member_invited'
  // SPRINT 14: Eventos de fricção
  | 'invite_not_used'
  | 'signup_abandoned'
  | 'first_action_timeout'
  | 'workflow_started_not_completed';

export interface PilotEvent {
  eventId: string;
  tenantId: string;
  eventType: PilotEventType;
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'company';
  occurredAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreatePilotEventInput {
  eventType: PilotEventType;
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'company';
  metadata?: Record<string, any>;
}

class PilotEventsRepository {
  /**
   * Cria um novo evento de observação
   * Verifica se já existe para evitar duplicatas
   */
  async create(
    tenantId: string,
    input: CreatePilotEventInput
  ): Promise<PilotEvent> {
    // Verificar se já existe evento do mesmo tipo para este actor
    const existing = await this.findByActorAndType(
      tenantId,
      input.actorId,
      input.eventType
    );

    if (existing) {
      // Retornar evento existente (não criar duplicata)
      return existing;
    }

    const result = await runQueryWithTenant<{
      event_id: string;
      tenant_id: string;
      event_type: string;
      actor_id: string;
      actor_type: string;
      occurred_at: Date;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
        INSERT INTO pilot_events (
          tenant_id, event_type, actor_id, actor_type,
          occurred_at, metadata
        )
        VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING *
      `,
      [
        tenantId,
        input.eventType,
        input.actorId,
        input.actorType,
        JSON.stringify(input.metadata || {}),
      ]
    );

    const row = result[0];
    return {
      eventId: row.event_id,
      tenantId: row.tenant_id,
      eventType: row.event_type as PilotEventType,
      actorId: row.actor_id,
      actorType: row.actor_type as 'user' | 'page' | 'group' | 'company',
      occurredAt: row.occurred_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Busca evento por actor e tipo
   */
  async findByActorAndType(
    tenantId: string,
    actorId: string,
    eventType: PilotEventType
  ): Promise<PilotEvent | null> {
    const result = await runQueryWithTenant<{
      event_id: string;
      tenant_id: string;
      event_type: string;
      actor_id: string;
      actor_type: string;
      occurred_at: Date;
      metadata: any;
      created_at: Date;
    }>(
      tenantId,
      `
        SELECT *
        FROM pilot_events
        WHERE tenant_id = $1
          AND actor_id = $2
          AND event_type = $3
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [tenantId, actorId, eventType]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      eventId: row.event_id,
      tenantId: row.tenant_id,
      eventType: row.event_type as PilotEventType,
      actorId: row.actor_id,
      actorType: row.actor_type as 'user' | 'page' | 'group' | 'company',
      occurredAt: row.occurred_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Lista todos os eventos de observação
   * Ordenado por data mais recente
   */
  async list(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      eventType?: PilotEventType;
    }
  ): Promise<PilotEvent[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `
      SELECT *
      FROM pilot_events
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (options?.eventType) {
      query += ` AND event_type = $${params.length + 1}`;
      params.push(options.eventType);
    }

    query += `
      ORDER BY occurred_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await runQueryWithTenant<{
      event_id: string;
      tenant_id: string;
      event_type: string;
      actor_id: string;
      actor_type: string;
      occurred_at: Date;
      metadata: any;
      created_at: Date;
    }>(tenantId, query, params);

    return result.map((row) => ({
      eventId: row.event_id,
      tenantId: row.tenant_id,
      eventType: row.event_type as PilotEventType,
      actorId: row.actor_id,
      actorType: row.actor_type as 'user' | 'page' | 'group' | 'company',
      occurredAt: row.occurred_at,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));
  }

  /**
   * Conta total de eventos
   */
  async count(
    tenantId: string,
    eventType?: PilotEventType
  ): Promise<number> {
    let query = `
      SELECT COUNT(*) as total
      FROM pilot_events
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (eventType) {
      query += ` AND event_type = $2`;
      params.push(eventType);
    }

    const result = await runQueryWithTenant<{ total: string }>(
      tenantId,
      query,
      params
    );

    return parseInt(result[0].total, 10);
  }
}

export const pilotEventsRepository = new PilotEventsRepository();

