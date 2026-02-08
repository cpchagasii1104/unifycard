// backend/src/modules/events/event.repository.ts
// SPRINT 76: Repository para events

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { Event, EventFilters } from './event.types';

interface EventRow {
  id: string;
  tenant_id: string;
  organizer_actor_id: string;
  title: string;
  description: string | null;
  location_actor_id: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  publishedAt: Date | null;
  published_by_actor_id: string | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  cancelled_by_actor_id: string | null;
  cancellation_reason: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class EventRepository {
  private toEvent(row: EventRow): Event {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      organizerActorId: row.organizer_actor_id,
      title: row.title,
      description: row.description,
      locationActorId: row.location_actor_id,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status as any,
      publishedAt: row.publishedAt,
      publishedByActorId: row.published_by_actor_id,
      closedAt: row.closedAt,
      cancelledAt: row.cancelledAt,
      cancelledByActorId: row.cancelled_by_actor_id,
      cancellationReason: row.cancellation_reason,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createEvent(
    tenantId: string,
    input: {
      organizerActorId: string;
      title: string;
      description: string | null;
      locationActorId: string | null;
      startAt: Date;
      endAt: Date;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<Event> {
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      INSERT INTO events (
        tenant_id, organizer_actor_id, title, description,
        location_actor_id, startAt, endAt, status,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING id, tenant_id, organizer_actor_id, title, description,
                location_actor_id, startAt, endAt, status,
                publishedAt, published_by_actor_id,
                closedAt, cancelledAt, cancelled_by_actor_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.organizerActorId,
        input.title,
        input.description,
        input.locationActorId,
        input.startAt,
        input.endAt,
        'DRAFT',
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar evento');
    }

    return this.toEvent(row);
  }

  async getEventById(tenantId: string, eventId: string): Promise<Event | null> {
    const rows = await runQueriesWithTenant<EventRow>(
      tenantId,
      `
      SELECT id, tenant_id, organizer_actor_id, title, description,
             location_actor_id, startAt, endAt, status,
             publishedAt, published_by_actor_id,
             closedAt, cancelledAt, cancelled_by_actor_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM events
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, eventId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toEvent(rows[0]);
  }

  async listEvents(tenantId: string, filters: EventFilters = {}): Promise<Event[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.organizerActorId) {
      conditions.push(`organizer_actor_id = $${paramIndex}`);
      params.push(filters.organizerActorId);
      paramIndex++;
    }

    if (filters.locationActorId) {
      conditions.push(`location_actor_id = $${paramIndex}`);
      params.push(filters.locationActorId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.startAtFrom) {
      const dateFrom = filters.startAtFrom instanceof Date ? filters.startAtFrom : new Date(filters.startAtFrom);
      conditions.push(`startAt >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (filters.startAtTo) {
      const dateTo = filters.startAtTo instanceof Date ? filters.startAtTo : new Date(filters.startAtTo);
      conditions.push(`startAt <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<EventRow>(
      tenantId,
      `
      SELECT id, tenant_id, organizer_actor_id, title, description,
             location_actor_id, startAt, endAt, status,
             publishedAt, published_by_actor_id,
             closedAt, cancelledAt, cancelled_by_actor_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM events
      WHERE ${conditions.join(' AND ')}
      ORDER BY startAt ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toEvent(row));
  }

  async publishEvent(
    tenantId: string,
    eventId: string,
    publishedByActorId: string
  ): Promise<Event> {
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET status = 'PUBLISHED',
          publishedAt = NOW(),
          published_by_actor_id = $3,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'DRAFT'
      RETURNING id, tenant_id, organizer_actor_id, title, description,
                location_actor_id, startAt, endAt, status,
                publishedAt, published_by_actor_id,
                closedAt, cancelledAt, cancelled_by_actor_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, eventId, publishedByActorId]
    );

    if (!row) {
      throw new Error('Evento não encontrado ou não está em DRAFT');
    }

    return this.toEvent(row);
  }

  async cancelEvent(
    tenantId: string,
    eventId: string,
    cancelledByActorId: string,
    cancellationReason: string | null
  ): Promise<Event> {
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      UPDATE events
      SET status = 'CANCELLED',
          cancelledAt = NOW(),
          cancelled_by_actor_id = $3,
          cancellation_reason = $4,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status IN ('DRAFT', 'PUBLISHED')
      RETURNING id, tenant_id, organizer_actor_id, title, description,
                location_actor_id, startAt, endAt, status,
                publishedAt, published_by_actor_id,
                closedAt, cancelledAt, cancelled_by_actor_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, eventId, cancelledByActorId, cancellationReason]
    );

    if (!row) {
      throw new Error('Evento não encontrado ou não pode ser cancelado');
    }

    return this.toEvent(row);
  }
}

export const eventRepository = new EventRepository();








