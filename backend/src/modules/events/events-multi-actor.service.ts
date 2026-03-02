// src/modules/events/events-multi-actor.service.ts
// Service para eventos multi-atores

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Event,
  EventRow,
  EventActor,
  EventActorRow,
  CreateEventInput,
  AddActorToEventInput,
  EventWithActors,
} from './events.types';

class EventsMultiActorService {
  /**
   * Converte EventRow para Event
   */
  private toEvent(row: EventRow & {
    datetime_start?: Date;
    datetime_end?: Date;
    location_name?: string | null;
    capacity?: number | null;
    created_by_actor_id?: string | null;
    status?: string;
  }): Event {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      startTime: row.starts_at,
      endTime: row.ends_at,
      datetimeStart: row.datetime_start || row.starts_at,
      datetimeEnd: row.datetime_end || row.ends_at,
      locationName: row.location_name || null,
      capacity: row.capacity || null,
      cityId: row.city_id,
      stateId: row.state_id,
      countryId: row.country_id,
      createdByGlobalUserId: row.created_by_global_user_id,
      createdByActorId: row.created_by_actor_id || null,
      status: (row.status || 'draft') as Event['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Converte EventActorRow para EventActor
   */
  private toEventActor(row: EventActorRow): EventActor {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventId: row.event_id,
      actorId: row.actor_id,
      role: row.role as EventActor['role'],
      canPublish: row.can_publish,
      canEdit: row.can_edit,
      revenueShareBps: row.revenue_share_percent,
      status: row.status as EventActor['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Cria um novo evento como DRAFT
   */
  async createEvent(
    tenantId: string,
    globalUserId: string,
    input: CreateEventInput
  ): Promise<Event> {
    // Buscar tenant para obter city_id padrão se necessário
    const tenant = await runQueryWithTenant<{ city_id: string | null }>(
      tenantId,
      'SELECT city_id FROM tenants WHERE tenant_id = $1',
      [tenantId]
    );

    const cityId = input.cityId ?? tenant?.city_id ?? null;

    const actorId = input.actorId;
    if (!actorId) {
      throw new Error('actorId é obrigatório para criar evento');
    }

    // Criar evento
    const eventRows = await runQueriesWithTenant<EventRow & {
      datetime_start: Date;
      datetime_end: Date;
      location_name: string | null;
      capacity: number | null;
      created_by_actor_id: string | null;
      status: string;
    }>(
      tenantId,
      `
        INSERT INTO events (
          tenant_id,
          title,
          description,
          starts_at,
          ends_at,
          datetime_start,
          datetime_end,
          location_name,
          capacity,
          city_id,
          state_id,
          country_id,
          created_by_global_user_id,
          created_by_actor_id,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
        RETURNING *
      `,
      [
        tenantId,
        input.title,
        input.description || null,
        input.startTime,
        input.endTime,
        input.startTime,
        input.endTime,
        input.locationName || null,
        input.capacity || null,
        cityId,
        input.stateId || null,
        input.countryId || null,
        globalUserId,
        actorId,
      ]
    );

    const firstRow = eventRows[0];
    if (!firstRow) {
      throw new Error('Falha ao criar evento');
    }
    const event = this.toEvent(firstRow);

    // Adicionar o criador como organizer automaticamente
    await this.addActorToEvent(tenantId, {
      eventId: event.id,
      actorId,
      role: 'organizer',
      canPublish: true,
      canEdit: true,
    });

    return event;
  }

  /**
   * Adiciona um actor a um evento
   */
  async addActorToEvent(
    tenantId: string,
    input: AddActorToEventInput
  ): Promise<EventActor> {
    // Verificar se o evento existe
    const eventRows = await runQueriesWithTenant<{ id: string; tenant_id: string }>(
      tenantId,
      'SELECT id, tenant_id FROM events WHERE id = $1',
      [input.eventId]
    );

    if (eventRows.length === 0) {
      throw new Error('Evento não encontrado');
    }

    // Verificar se o actor já está no evento
    const existingRows = await runQueriesWithTenant<{ id: string }>(
      tenantId,
      'SELECT id FROM event_actor WHERE event_id = $1 AND actor_id = $2',
      [input.eventId, input.actorId]
    );

    if (existingRows.length > 0) {
      throw new Error('Actor já está vinculado a este evento');
    }

    // Adicionar actor ao evento
    const actorRows = await runQueryWithTenant<EventActorRow>(
      tenantId,
      `
        INSERT INTO event_actor (
          tenant_id,
          event_id,
          actor_id,
          role,
          can_publish,
          can_edit,
          revenue_share_percent,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `,
      [
        tenantId,
        input.eventId,
        input.actorId,
        input.role,
        input.canPublish || false,
        input.canEdit || false,
        input.revenueShareBps || null,
      ]
    );

    if (!actorRows) {
      throw new Error('Falha ao inserir actor no evento');
    }
    return this.toEventActor(actorRows);
  }

  /**
   * Aceita ou rejeita participação de um actor
   */
  async updateActorStatus(
    tenantId: string,
    eventActorId: string,
    status: 'accepted' | 'rejected'
  ): Promise<EventActor> {
    const actorRows = await runQueriesWithTenant<EventActorRow>(
      tenantId,
      `
        UPDATE event_actor
        SET status = $1, updatedAt = now()
        WHERE id = $2 AND tenant_id = $3
        RETURNING *
      `,
      [status, eventActorId, tenantId]
    );

    if (actorRows.length === 0) {
      throw new Error('Participação não encontrada');
    }

    const firstRow = actorRows[0];
    if (!firstRow) {
      throw new Error('Participação não encontrada');
    }
    return this.toEventActor(firstRow);
  }

  /**
   * Publica um evento (verifica requisitos mínimos)
   */
  async publishEvent(tenantId: string, eventId: string): Promise<Event> {
    // Verificar requisitos mínimos
    const requirementsRows = await runQueryWithTenant<{ check_event_publish_requirements: boolean }>(
      tenantId,
      'SELECT check_event_publish_requirements($1) as check_event_publish_requirements',
      [eventId]
    );

    const requirements = Array.isArray(requirementsRows) ? requirementsRows[0] : requirementsRows;
    if (!requirements?.check_event_publish_requirements) {
      throw new Error(
        'Evento não pode ser publicado: requer pelo menos 1 artist e 1 venue aceitos'
      );
    }

    // Atualizar status
    const eventRows = await runQueriesWithTenant<EventRow & {
      datetime_start: Date;
      datetime_end: Date;
      location_name: string | null;
      capacity: number | null;
      created_by_actor_id: string | null;
      status: string;
    }>(
      tenantId,
      `
        UPDATE events
        SET status = 'published', updatedAt = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `,
      [eventId, tenantId]
    );

    if (eventRows.length === 0) {
      throw new Error('Evento não encontrado');
    }

    return this.toEvent(eventRows[0]);
  }

  /**
   * Busca evento com seus actors
   */
  async getEventWithActors(tenantId: string, eventId: string): Promise<EventWithActors | null> {
    // Buscar evento
    const eventRows = await runQueriesWithTenant<EventRow & {
      datetime_start: Date;
      datetime_end: Date;
      location_name: string | null;
      capacity: number | null;
      created_by_actor_id: string | null;
      status: string;
    }>(
      tenantId,
      'SELECT * FROM events WHERE id = $1 AND tenant_id = $2',
      [eventId, tenantId]
    );

    if (eventRows.length === 0) {
      return null;
    }

    const event = this.toEvent(eventRows[0]);

    // Buscar actors
    const actorRows = await runQueriesWithTenant<EventActorRow>(
      tenantId,
      'SELECT * FROM event_actor WHERE event_id = $1 AND tenant_id = $2',
      [eventId, tenantId]
    );

    const actors = actorRows.map((row) => this.toEventActor(row));

    return {
      ...event,
      actors,
    };
  }

  /**
   * Busca eventos de um actor específico
   */
  async getEventsByActor(
    tenantId: string,
    actorId: string,
    options: { status?: Event['status']; limit?: number; offset?: number } = {}
  ): Promise<{ events: Event[]; totalCents: number }> {
    const { status, limit = 50, offset = 0 } = options;

    let query = `
      SELECT DISTINCT e.*
      FROM events e
      INNER JOIN event_actor ea ON ea.event_id = e.id
      WHERE e.tenant_id = $1 AND ea.actor_id = $2
    `;

    const params: any[] = [tenantId, actorId];
    let paramIndex = 3;

    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY e.datetime_start DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const eventRows = await runQueriesWithTenant<EventRow & {
      datetime_start: Date;
      datetime_end: Date;
      location_name: string | null;
      capacity: number | null;
      created_by_actor_id: string | null;
      status: string;
    }>(tenantId, query, params);

    // Contar total
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM events e
      INNER JOIN event_actor ea ON ea.event_id = e.id
      WHERE e.tenant_id = $1 AND ea.actor_id = $2
    `;
    const countParams: any[] = [tenantId, actorId];
    let countParamIndex = 3;

    if (status) {
      countQuery += ` AND e.status = $${countParamIndex}`;
      countParams.push(status);
    }

    const countRows = await runQueriesWithTenant<{ total: string }>(
      tenantId,
      countQuery,
      countParams
    );

    return {
      events: eventRows.map((row) => this.toEvent(row)),
      totalCents: parseInt(countRows[0]?.total ?? '0', 10),
    };
  }
}

export const eventsMultiActorService = new EventsMultiActorService();





