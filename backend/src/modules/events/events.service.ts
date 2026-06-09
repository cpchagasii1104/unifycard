// src/modules/events/events.service.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { tenantService } from '@core/tenants/tenant.service';
import { worldService } from '@core/world/services/world.service';
import { reputationService } from '@core/reputation/reputation.service';
import { occupancyService } from './occupancy.service';
import type {
  Event,
  EventRow,
  EventSession,
  EventSessionRow,
  EventLocation,
  EventLocationRow,
  EventStaff,
  EventStaffRow,
  EventAttendee,
  EventAttendeeRow,
  CreateEventInput,
  AddSessionInput,
  AssignStaffInput,
  EventWithDetails,
  SearchEventsOptions,
} from './events.types';
import type { CreateOccupancyModelInput, OccupancyType } from './occupancy.types';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

type EventStatusForModule = 'draft' | 'published' | 'cancelled' | 'finished' | 'completed' | 'archived';

function mapRowStatusToEventStatus(s: string | undefined): EventStatusForModule {
  const v = (s || 'draft').toLowerCase();
  if (v === 'draft' || v === 'published' || v === 'cancelled' || v === 'finished' || v === 'completed' || v === 'archived') {
    return v as EventStatusForModule;
  }
  if (v === 'active' || v === 'declared') return 'published';
  if (v === 'ended') return 'finished';
  return 'draft';
}

class EventsService {
  private toEvent(row: EventRow): Event {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const regional = meta.regional as Record<string, string> | undefined;
    const dtStart = row.datetime_start ?? new Date(0);
    const dtEnd = row.datetime_end ?? new Date(0);
    const ticketCents =
      row.ticket_price_cents !== null && row.ticket_price_cents !== undefined
        ? Number(row.ticket_price_cents)
        : null;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      startTime: dtStart,
      endTime: dtEnd,
      datetimeStart: dtStart,
      datetimeEnd: dtEnd,
      locationName: (meta.location_name as string) || null,
      capacity: row.max_attendees ?? (meta.capacity as number | null) ?? null,
      cityId: regional?.city_id ?? null,
      stateId: regional?.state_id ?? null,
      countryId: regional?.country_id ?? null,
      createdByGlobalUserId: (meta.created_by_global_user_id as string) || '',
      createdByActorId: row.actor_id,
      eventType: row.event_type,
      ticketPrice: ticketCents,
      acceptsConsumption: Boolean(meta.accepts_consumption),
      acceptsParking: Boolean(meta.accepts_parking),
      maxCapacity: row.max_attendees,
      currentOccupancy: typeof meta.current_occupancy === 'number' ? meta.current_occupancy : 0,
      status: mapRowStatusToEventStatus(row.status),
      timezone: row.timezone,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toEventSession(row: EventSessionRow): EventSession {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      startTime: row.start_time,
      endTime: row.end_time,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toEventLocation(row: EventLocationRow): EventLocation {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      capacity: row.capacity,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toEventStaff(row: EventStaffRow): EventStaff {
    return {
      id: row.id,
      eventId: row.event_id,
      globalUserId: row.global_user_id,
      role: row.role,
      assignedByGlobalUserId: row.assigned_by_global_user_id,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toEventAttendee(row: EventAttendeeRow): EventAttendee {
    return {
      id: row.id,
      eventId: row.event_id,
      globalUserId: row.global_user_id,
        checkInTime: row.checked_in_at,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria um novo evento
   */
  async createEvent(
    tenantId: string,
    input: CreateEventInput,
    createdByGlobalUserId: string
  ): Promise<Event> {
    // Obter região do tenant como fallback
    const tenant = await tenantService.getTenantById(tenantId);
    
    let finalCityId = input.cityId ?? tenant?.cityId ?? null;
    let finalStateId = input.stateId ?? null;
    let finalCountryId = input.countryId ?? null;

    // Se cityId foi fornecido, validar e obter stateId/countryId automaticamente
    if (finalCityId) {
      const cityPath = await worldService.getCityFullPath(finalCityId);
      if (!cityPath) {
        throw new Error('Cidade não encontrada');
      }
      finalStateId = cityPath.state.stateId;
      finalCountryId = cityPath.country.countryId;
    } else if (finalStateId) {
      // Se stateId foi fornecido, validar e obter countryId automaticamente
      const state = await worldService.getStateById(finalStateId);
      if (!state) {
        throw new Error('Estado não encontrado');
      }
      finalCountryId = state.countryId;
    } else if (finalCountryId) {
      // Validar se país existe
      const country = await worldService.getCountryById(finalCountryId);
      if (!country) {
        throw new Error('País não encontrado');
      }
    } else if (tenant?.cityId) {
      // Usar região do tenant
      const cityPath = await worldService.getCityFullPath(tenant.cityId);
      if (cityPath) {
        finalCityId = cityPath.city.cityId;
        finalStateId = cityPath.state.stateId;
        finalCountryId = cityPath.country.countryId;
      }
    }

    // Validar hierarquia se todos os campos foram fornecidos
    if (finalStateId && finalCountryId) {
      const state = await worldService.getStateById(finalStateId);
      if (!state || state.countryId !== finalCountryId) {
        throw new Error('Estado não pertence ao país especificado');
      }
    }

    if (finalCityId && finalStateId) {
      const city = await worldService.getCityById(finalCityId);
      if (!city || city.stateId !== finalStateId) {
        throw new Error('Cidade não pertence ao estado especificado');
      }
    }

    // Validar que endTime > startTime
    if (input.endTime <= input.startTime) {
      throw new Error('Data/hora de fim deve ser posterior à data/hora de início');
    }

    const { actorRepository } = await import('@modules/social/actor.repository');

    let actorIdForEvent: string;
    let actorTypeForEvent: string;

    if (input.actorId) {
      const actorRow = await actorRepository.findById(tenantId, input.actorId);
      if (!actorRow) {
        throw new Error('Actor não encontrado');
      }
      actorIdForEvent = actorRow.actor_id;
      actorTypeForEvent = actorRow.actor_type;
    } else {
      const userResult = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `SELECT user_id FROM users WHERE global_user_id = $1 AND tenant_id = $2 LIMIT 1`,
        [createdByGlobalUserId, tenantId]
      );
      if (!userResult?.user_id) {
        throw new Error('Usuário não encontrado para o tenant');
      }
      const userActor = await ensureUserActor(tenantId, userResult.user_id);
      actorIdForEvent = userActor.actor_id;
      actorTypeForEvent = userActor.actor_type;
    }

    /** Shape estável em JSON: só UUIDs preenchidos (sem strings vazias). */
    let regionalBlock: { city_id?: string; state_id?: string; country_id?: string } | undefined;
    if (finalCityId || finalStateId || finalCountryId) {
      regionalBlock = {};
      if (finalCityId) regionalBlock.city_id = finalCityId;
      if (finalStateId) regionalBlock.state_id = finalStateId;
      if (finalCountryId) regionalBlock.country_id = finalCountryId;
    }

    const eventTypeForRow = (input.eventType && String(input.eventType).trim()) || 'general';
    const timezoneForRow = (input.timezone && String(input.timezone).trim()) || 'UTC';

    const metadataPayload: Record<string, unknown> = { ...(input.metadata || {}) };
    if (regionalBlock && Object.keys(regionalBlock).length > 0) {
      metadataPayload.regional = regionalBlock;
    }
    metadataPayload.created_by_global_user_id = createdByGlobalUserId;
    if (input.locationName != null && input.locationName !== '') {
      metadataPayload.location_name = input.locationName;
    }
    if (input.capacity != null) {
      metadataPayload.capacity = input.capacity;
    }

    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      INSERT INTO events (
        tenant_id,
        actor_id,
        actor_type,
        event_type,
        event_subtype,
        title,
        description,
        datetime_start,
        datetime_end,
        timezone,
        status,
        visibility,
        max_attendees,
        ticket_price_cents,
        currency,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, NULL,
        $5, $6, $7, $8, $9,
        'draft', 'public',
        $10, NULL, 'BRL',
        $11::jsonb
      )
      RETURNING id, tenant_id, actor_id, actor_type, event_type, event_subtype,
                title, description, datetime_start, datetime_end, timezone,
                status, visibility, ticket_price_cents, max_attendees, currency,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        actorIdForEvent,
        actorTypeForEvent,
        eventTypeForRow,
        input.title,
        input.description ?? null,
        input.startTime,
        input.endTime,
        timezoneForRow,
        input.capacity ?? null,
        JSON.stringify(metadataPayload),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar evento');
    }

    const event = this.toEvent(row);

    // Se houver group_id, criar relacionamento na tabela group_events
    // 🔴 FASE 2: group_events.startsAt/endsAt são READ-MODEL ou INPUT declarativo, não verdade temporal
    // A verdade temporal está em Unified Availability (criada via event.service.ts)
    if (input.group_id) {
      try {
        // Verificar se já existe relacionamento (evitar duplicata)
        const existing = await runQueryWithTenant<{ event_id: string }>(
          tenantId,
          `SELECT event_id FROM group_events WHERE event_id = $1 AND tenant_id = $2 LIMIT 1`,
          [event.id, tenantId]
        );

        if (!existing) {
          // 🔴 FASE 2: startsAt/endsAt aqui são apenas READ-MODEL para visualização
          // Não bloqueiam agenda, não resolvem conflito, não criam booking
          await runQueryWithTenant(
            tenantId,
            `
            INSERT INTO group_events (
              event_id, group_id, tenant_id, title, description, starts_at, ends_at, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              event.id,
              input.group_id,
              tenantId,
              input.title,
              input.description ?? null,
              input.startTime,
              input.endTime,
              createdByGlobalUserId,
            ]
          );
        }

        // Publicar evento automaticamente no feed com actionType = event
        try {
          const { social2Service } = await import('@modules/social/social-2.0.service');
          
          // Buscar userId do globalUserId
          const userResult = await runQueryWithTenant<{ user_id: string }>(
            tenantId,
            `SELECT user_id FROM users WHERE global_user_id = $1 AND tenant_id = $2 LIMIT 1`,
            [createdByGlobalUserId, tenantId]
          );

          if (userResult) {
            const actor = await ensureUserActor(tenantId, userResult.user_id);
            
            if (actor) {
              // Criar post no feed anunciando o evento
              await social2Service.createPost(
                tenantId,
                userResult.user_id,
                `🎉 Novo evento: ${input.title}${input.description ? `\n\n${input.description}` : ''}`,
                actor.actor_id,
                [],
                'event', // Intent = event
                {
                  eventId: event.id,
                  eventTitle: input.title,
                  eventStartTime: input.startTime.toISOString(),
                  eventEndTime: input.endTime.toISOString(),
                },
                undefined, // targeting
                undefined, // cta
                input.group_id // groupId para vincular ao grupo
              );
            }
          }
        } catch (feedError) {
          // Log mas não quebra criação do evento
          console.error('Erro ao publicar evento no feed:', feedError);
        }
      } catch (err) {
        // Log mas não quebra criação do evento
        console.error('Erro ao vincular evento ao grupo:', err);
      }
    }

    // Se houver metadata com modelo de ocupação, criar
    if (input.metadata && typeof input.metadata.occupancy_model === 'object' && input.metadata.occupancy_model) {
      const occupancyData = input.metadata.occupancy_model as {
        type: string;
        requires_reservation?: boolean;
        reservation_price?: number;
        config?: Record<string, unknown>;
      };
      try {
        await occupancyService.createOrUpdateOccupancyModel(tenantId, {
          event_id: event.id,
          occupancy_type: occupancyData.type as OccupancyType,
          requires_reservation: occupancyData.requires_reservation ?? false,
          reservation_price_cents: occupancyData.reservation_price,
          config: (occupancyData.config || {}) as unknown as CreateOccupancyModelInput['config'],
        });
      } catch (err) {
        // Log mas não quebra criação do evento
        console.error('Erro ao criar modelo de ocupação:', err);
      }
    }

    return event;
  }

  /**
   * Adiciona uma sessão a um evento
   */
  async addSession(
    tenantId: string,
    eventId: string,
    input: AddSessionInput
  ): Promise<EventSession> {
    // Verificar se evento existe
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    // Validar que endTime > startTime
    const startTime = input.startTime;
    const endTime = input.endTime;
    if (startTime == null || endTime == null) {
      throw new Error('startTime e endTime são obrigatórios');
    }
    if (endTime <= startTime) {
      throw new Error('Data/hora de fim deve ser posterior à data/hora de início');
    }

    // Validar que sessão está dentro do período do evento
    if (startTime < event.startTime || endTime > event.endTime) {
      throw new Error('Sessão deve estar dentro do período do evento');
    }

    const row = await runQueryWithTenant<EventSessionRow>(
      tenantId,
      `
      INSERT INTO event_sessions (event_id, name, start_time, end_time)
      VALUES ($1, $2, $3, $4)
      RETURNING id, event_id, name, start_time, end_time, created_at, updated_at
      `,
      [eventId, input.name, startTime, endTime]
    );

    if (!row) {
      throw new Error('Falha ao criar sessão');
    }

    return this.toEventSession(row);
  }

  /**
   * Designa staff para um evento
   */
  async assignStaff(
    tenantId: string,
    eventId: string,
    input: AssignStaffInput,
    assignedByGlobalUserId: string
  ): Promise<EventStaff> {
    // Verificar se evento existe
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    const globalUserId = input.globalUserId;
    if (!globalUserId) {
      throw new Error('globalUserId é obrigatório');
    }

    // Validar reputação mínima (exemplo: score >= 3.0)
    const reputation = await reputationService.getScoreByGlobalUserId(globalUserId);
    if (!reputation || reputation.scores.global < 3.0) {
      throw new Error('Usuário não possui reputação suficiente para ser designado como staff');
    }

    // Verificar se já está designado
    const existing = await runQueryWithTenant<EventStaffRow>(
      tenantId,
      `
      SELECT id, event_id, global_user_id, role, assigned_by_global_user_id, created_at
      FROM event_staff
      WHERE event_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [eventId, input.globalUserId]
    );

    if (existing) {
      throw new Error('Usuário já está designado como staff deste evento');
    }

    const row = await runQueryWithTenant<EventStaffRow>(
      tenantId,
      `
      INSERT INTO event_staff (event_id, global_user_id, role, assigned_by_global_user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, event_id, global_user_id, role, assigned_by_global_user_id, created_at
      `,
      [eventId, globalUserId, input.role, assignedByGlobalUserId]
    );

    if (!row) {
      throw new Error('Falha ao designar staff');
    }

    return this.toEventStaff(row);
  }

  /**
   * Realiza check-in de um participante
   */
  async checkIn(
    tenantId: string,
    eventId: string,
    globalUserId: string
  ): Promise<{ checkedIn: boolean; checkInTime: Date }> {
    // Verificar se evento existe e está ativo
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }
    if (event.status === 'cancelled' || event.status === 'completed' || event.status === 'archived') {
      throw new Error(`Evento com status '${event.status}' não aceita check-in`);
    }

    // Verificar se já está inscrito
    const existing = await runQueryWithTenant<EventAttendeeRow>(
      tenantId,
      `
      SELECT id, event_id, global_user_id, checked_in_at, created_at
      FROM event_attendees
      WHERE event_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [eventId, globalUserId]
    );

    if (!existing) {
      // Criar registro de participante
      await runQueryWithTenant<EventAttendeeRow>(
        tenantId,
        `
        INSERT INTO event_attendees (event_id, global_user_id, checked_in_at)
        VALUES ($1, $2, now())
        RETURNING id, event_id, global_user_id, checked_in_at, created_at
        `,
        [eventId, globalUserId]
      );
    } else if (!existing.checked_in_at) {
      // Atualizar check-in
      await runQueryWithTenant<EventAttendeeRow>(
        tenantId,
        `
        UPDATE event_attendees
        SET checked_in_at = now()
        WHERE event_id = $1 AND global_user_id = $2
        RETURNING id, event_id, global_user_id, checked_in_at, created_at
        `,
        [eventId, globalUserId]
      );
    }

    // Buscar registro atualizado
    const updated = await runQueryWithTenant<EventAttendeeRow>(
      tenantId,
      `
      SELECT id, event_id, global_user_id, checked_in_at, created_at
      FROM event_attendees
      WHERE event_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [eventId, globalUserId]
    );

    if (!updated || !updated.checked_in_at) {
      throw new Error('Falha ao realizar check-in');
    }

    return {
      checkedIn: true,
      checkInTime: updated.checked_in_at,
    };
  }

  /**
   * Busca um evento por ID
   */
  async getEvent(tenantId: string, eventId: string): Promise<Event | null> {
    const row = await runQueryWithTenant<EventRow>(
      tenantId,
      `
      SELECT
        id, tenant_id, actor_id, actor_type, event_type, event_subtype,
        title, description, datetime_start, datetime_end, timezone,
        status, visibility, ticket_price_cents, max_attendees, currency,
        metadata, created_at, updated_at
      FROM events
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    return row ? this.toEvent(row) : null;
  }

  /**
   * Busca evento com detalhes completos
   */
  async getEventWithDetails(tenantId: string, eventId: string): Promise<EventWithDetails | null> {
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      return null;
    }

    // Buscar sessões
    const sessionsRows = await runQueriesWithTenant<EventSessionRow>(
      tenantId,
      `
      SELECT id, event_id, name, start_time, end_time, created_at, updated_at
      FROM event_sessions
      WHERE event_id = $1
      ORDER BY start_time ASC
      `,
      [eventId]
    );

    // Buscar locais
    const locationsRows = await runQueriesWithTenant<EventLocationRow>(
      tenantId,
      `
      SELECT id, event_id, name, capacity, created_at, updated_at
      FROM event_locations
      WHERE event_id = $1
      ORDER BY name ASC
      `,
      [eventId]
    );

    // Buscar staff
    const staffRows = await runQueriesWithTenant<EventStaffRow>(
      tenantId,
      `
      SELECT id, event_id, global_user_id, role, assigned_by_global_user_id, created_at
      FROM event_staff
      WHERE event_id = $1
      ORDER BY role ASC, created_at ASC
      `,
      [eventId]
    );

    // Contar participantes
    const attendeeCountRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM event_attendees
      WHERE event_id = $1
      `,
      [eventId]
    );

    // Contar check-ins
    const checkedInCountRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM event_attendees
      WHERE event_id = $1 AND checked_in_at IS NOT NULL
      `,
      [eventId]
    );

    return {
      ...event,
      sessions: sessionsRows.map((r) => this.toEventSession(r)),
      locations: locationsRows.map((r) => this.toEventLocation(r)),
      staff: staffRows.map((r) => this.toEventStaff(r)),
      attendeeCount: attendeeCountRow ? Number(attendeeCountRow.count) : 0,
      checkedInCount: checkedInCountRow ? Number(checkedInCountRow.count) : 0,
    };
  }

  /**
   * Busca posts relacionados ao evento
   */
  async getEventPosts(
    tenantId: string,
    eventId: string,
    limit: number = 20
  ): Promise<Array<{
    postId: string;
    content: string;
    type: string;
    createdAt: Date;
    globalUserId: string;
    media: any[];
    metadata: Record<string, any>;
  }>> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `
      SELECT 
        post_id,
        content,
        type,
        created_at,
        global_user_id,
        media,
        metadata
      FROM posts
      WHERE tenant_id = $1
        AND event_id = $2
        AND visibility = 'PUBLIC'
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [tenantId, eventId, limit]
    );

    return rows.map((row) => ({
      postId: row.post_id,
      content: row.content,
      type: row.type,
      createdAt: row.created_at,
      globalUserId: row.global_user_id,
      media: Array.isArray(row.media) ? row.media : [],
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    }));
  }

  /**
   * Busca participantes do evento (com informações básicas)
   */
  async getEventParticipants(
    tenantId: string,
    eventId: string,
    limit: number = 50
  ): Promise<Array<{
    globalUserId: string;
    checkInTime: Date | null;
    joinedAt: Date;
  }>> {
    const rows = await runQueriesWithTenant<EventAttendeeRow>(
      tenantId,
      `
      SELECT 
        id,
        event_id,
        global_user_id,
          checked_in_at,
        created_at
      FROM event_attendees
      WHERE event_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [eventId, limit]
    );

    return rows.map((row) => ({
      globalUserId: row.global_user_id,
        checkInTime: row.checked_in_at,
      joinedAt: row.created_at,
    }));
  }

  /**
   * Busca eventos com filtros
   */
  async searchEvents(tenantId: string, options: SearchEventsOptions = {}): Promise<Event[]> {
    const {
      cityId,
      stateId,
      countryId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      discoveryUserId,
    } = options;

    let query = `
      SELECT
        id, tenant_id, actor_id, actor_type, event_type, event_subtype,
        title, description, datetime_start, datetime_end, timezone,
        status, visibility, ticket_price_cents, max_attendees, currency,
        metadata, created_at, updated_at
      FROM events
      WHERE tenant_id = $1
    `;

    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (cityId) {
      query += ` AND metadata->'regional'->>'city_id' = $${paramIndex}`;
      params.push(cityId);
      paramIndex++;
    }

    if (stateId) {
      query += ` AND metadata->'regional'->>'state_id' = $${paramIndex}`;
      params.push(stateId);
      paramIndex++;
    }

    if (countryId) {
      query += ` AND metadata->'regional'->>'country_id' = $${paramIndex}`;
      params.push(countryId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND datetime_start >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND datetime_end <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-C — PISO DE DISCOVERY (mesma régua B1–B4): search é 2ª listagem pública e
    // deve herdar o piso. Só status published/active; visibility 'public' SEMPRE OU 'group' (membro material via
    // group_members.user_id) OU 'followers' (follow material via follows + actors.user_id) — discoveryUserId
    // (= req.user.userId, NUNCA actorId declarado). private/unlisted/draft/declared/ended/cancelled FORA.
    query += ` AND status IN ('published','active')`;
    const visParts: string[] = [`visibility = 'public'`];
    if (discoveryUserId) {
      visParts.push(
        `(visibility = 'group' AND actor_id IN (SELECT a.id FROM actors a ` +
          `JOIN group_members gm ON gm.group_id = a.group_id AND gm.tenant_id = a.tenant_id AND gm.user_id = $${paramIndex} ` +
          `WHERE a.tenant_id = $1 AND a.group_id IS NOT NULL))`
      );
      params.push(discoveryUserId);
      paramIndex++;
      visParts.push(
        `(visibility = 'followers' AND actor_id IN (SELECT f.followed_actor_id FROM follows f ` +
          `JOIN actors fa ON fa.id = f.follower_actor_id AND fa.tenant_id = f.tenant_id AND fa.user_id = $${paramIndex} ` +
          `WHERE f.tenant_id = $1))`
      );
      params.push(discoveryUserId);
      paramIndex++;
    }
    query += ` AND (${visParts.join(' OR ')})`;

    query += ` ORDER BY datetime_start ASC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<EventRow>(tenantId, query, params);

    return rows.map((r) => this.toEvent(r));
  }
}

export const eventsService = new EventsService();
















