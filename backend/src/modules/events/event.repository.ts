// backend/src/modules/events/event.repository.ts
// SPRINT 76: Repository para events — alinhado ao DDL canónico (actor_id → actors.id).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { Event, EventFilters, EventStatus } from './event.types';

interface EventRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  event_type: string;
  event_subtype: string | null;
  title: string;
  description: string | null;
  datetime_start: Date | null;
  datetime_end: Date | null;
  timezone: string;
  status: string;
  visibility: string;
  ticket_price_cents: string | number | null;
  max_attendees: number | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

function dbStatusToSprint76(s: string): EventStatus {
  const v = (s || 'draft').toLowerCase();
  if (v === 'draft') return 'DRAFT';
  if (v === 'published' || v === 'declared' || v === 'active') return 'PUBLISHED';
  if (v === 'cancelled') return 'CANCELLED';
  if (v === 'ended') return 'CLOSED';
  return 'DRAFT';
}

function sprint76StatusToDb(s: EventStatus): string {
  switch (s) {
    case 'DRAFT':
      return 'draft';
    case 'PUBLISHED':
      return 'published';
    case 'CANCELLED':
      return 'cancelled';
    case 'CLOSED':
      return 'ended';
    default:
      return 'draft';
  }
}

class EventRepository {
  private toEvent(row: EventRow): Event {
    const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
      string,
      unknown
    >;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      organizerActorId: row.actor_id,
      title: row.title,
      description: row.description,
      locationActorId: (meta.location_actor_id as string) || null,
      startAt: row.datetime_start ?? new Date(0),
      endAt: row.datetime_end ?? new Date(0),
      status: dbStatusToSprint76(row.status),
      // 🔴 O STATUS REAL, CRU DA COLUNA — aditivo, ao lado do legado, sem quebrar consumidor algum.
      // `dbStatusToSprint76` DESTRÓI informação: funde published|declared|active num só 'PUBLISHED'.
      // Um evento DECLARED (não publicado, não à venda, fora do feed) chega ao cliente como
      // "PUBLISHED" — quem confiasse nisso mostraria "publicado" para algo que não está no ar.
      // Descoberto em 2026-08-03 pela tela Meus Eventos: 37 eventos caíram em "Outros status"
      // porque o vocabulário legado é MAIÚSCULO e não existe no banco (events.status é minúsculo:
      // draft·declared·published·active·ended·cancelled).
      // Quem precisa da verdade usa `statusCanonical`; o legado segue intocado até sua convergência.
      statusCanonical: row.status,
      publishedAt: meta.published_at ? new Date(meta.published_at as string) : null,
      publishedByActorId: (meta.published_by_actor_id as string) || null,
      closedAt: meta.closed_at ? new Date(meta.closed_at as string) : null,
      cancelledAt: meta.cancelled_at ? new Date(meta.cancelled_at as string) : null,
      cancelledByActorId: (meta.cancelled_by_actor_id as string) || null,
      cancellationReason: (meta.cancellation_reason as string) || null,
      createdByActorId: (meta.created_by_actor_id as string) || row.actor_id,
      createdByUserId: (meta.created_by_user_id as string) || null,
      metadata: meta,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async createEvent(
    tenantId: string,
    input: {
      organizerActorId: string;
      organizerActorType?: string;
      eventType?: string;
      eventSubtype?: string | null;
      title: string;
      description: string | null;
      locationActorId: string | null;
      startAt: Date;
      endAt: Date;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
      visibility?: string;
      timezone?: string;
    }
  ): Promise<Event> {
    // 🔴 A1c (EVENT-ENGINE-COMPLETION, §2/§4.8): WRITER ÚNICO. Este writer LEGADO (sprint76, INSERT INTO
    // events paralelo) foi CONTIDO. Criação canônica = core/events/event.service.ts createEvent (via
    // /api/events/v2/create). Throw HONESTO como PRIMEIRA instrução — nenhum INSERT paralelo executável,
    // nem por curl. Corpo original preservado ABAIXO (dead-code documentado).
    throw new Error('EVENT_LEGACY_WRITER_CONVERGED: writer legado de evento (sprint76 repository) contido — use POST /api/events/v2/create (guided flow format-first).');

    const actorType = input.organizerActorType || 'user';
    const eventType = (input.eventType && String(input.eventType).trim()) || 'general';
    const visibility = input.visibility || 'public';
    const timezone = (input.timezone && String(input.timezone).trim()) || 'UTC';

    const meta: Record<string, unknown> = { ...(input.metadata || {}) };
    if (input.locationActorId) {
      meta.location_actor_id = input.locationActorId;
    }
    meta.created_by_actor_id = input.createdByActorId;
    if (input.createdByUserId) {
      meta.created_by_user_id = input.createdByUserId;
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
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      RETURNING id, tenant_id, actor_id, actor_type, event_type, event_subtype,
                title, description, datetime_start, datetime_end, timezone,
                status, visibility, ticket_price_cents, max_attendees, currency,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.organizerActorId,
        actorType,
        eventType,
        input.eventSubtype ?? null,
        input.title,
        input.description,
        input.startAt,
        input.endAt,
        timezone,
        'draft',
        visibility,
        JSON.stringify(meta),
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
      SELECT id, tenant_id, actor_id, actor_type, event_type, event_subtype,
             title, description, datetime_start, datetime_end, timezone,
             status, visibility, ticket_price_cents, max_attendees, currency,
             metadata, created_at, updated_at
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
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters.organizerActorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.organizerActorId);
      paramIndex++;
    } else if (filters.organizerActorIds && filters.organizerActorIds.length > 0) {
      conditions.push(`actor_id = ANY($${paramIndex}::uuid[])`);
      params.push(filters.organizerActorIds);
      paramIndex++;
    }

    if (filters.locationActorId) {
      conditions.push(`metadata->>'location_actor_id' = $${paramIndex}`);
      params.push(filters.locationActorId);
      paramIndex++;
    }

    // 🔵 DECISION-0113 F6.5.6b — modo de visibilidade (default = sem modo → callers internos como my-orders
    // intactos). 'public_discovery' (B1) = piso público deny-first. 'organizer_dashboard' (B2) = sem piso, mas
    // EXIGE organizerActorId (fail-closed) → o organizer representável vê os PRÓPRIOS não-públicos. O `status`/
    // `visibility` do cliente só ESTREITAM, nunca ampliam. 'declared' fora do piso público por decisão Clayton.
    if (filters.visibilityMode === 'public_discovery') {
      // PISO DE STATUS (published/active) aplica a TODA visibility permitida; cliente só estreita dentro do piso.
      const floorStatuses = ['published', 'active'];
      if (filters.status) {
        const requested = sprint76StatusToDb(filters.status);
        if (floorStatuses.includes(requested)) {
          conditions.push(`status = $${paramIndex}`);
          params.push(requested);
          paramIndex++;
        } else {
          conditions.push('1 = 0'); // cliente pediu status fora do piso → vazio seguro (não amplia o piso)
        }
      } else {
        conditions.push(`status = ANY($${paramIndex}::text[])`);
        params.push(floorStatuses);
        paramIndex++;
      }
      // VISIBILITY permitida na discovery — vocabulário CANÔNICO (F-EVENT-AUDIENCE-SSOT-UNIFICATION):
      // 'public' SEMPRE; 'connections' SÓ p/ organizers com aresta ACEITA com algum actor server-side do
      // caller (actor_relationships por actors.user_id = discoveryUserId — NUNCA actorId declarado),
      // refinado por audience_relationship_types (mesma régua do canViewEvent/listDiscoverable). 'only_me'
      // NÃO entra na discovery. discoveryUserId vem de req.user.
      const wantPublic = !filters.visibility || filters.visibility === 'public';
      const wantConnections = !filters.visibility || filters.visibility === 'connections';
      const visParts: string[] = [];
      if (wantPublic) visParts.push(`visibility = 'public'`);
      if (wantConnections && filters.discoveryUserId) {
        visParts.push(
          `(visibility = 'connections' AND EXISTS (` +
            `SELECT 1 FROM actor_relationships ar ` +
            `JOIN actors va ON va.tenant_id = ar.tenant_id AND va.user_id = $${paramIndex} ` +
            `WHERE ar.tenant_id = $1 AND ar.status = 'accepted' ` +
              `AND ((ar.from_actor_id = events.actor_id AND ar.to_actor_id = va.id) OR (ar.from_actor_id = va.id AND ar.to_actor_id = events.actor_id)) ` +
              `AND (events.audience_relationship_types IS NULL ` +
                `OR ar.requester_label = ANY(events.audience_relationship_types) ` +
                `OR ar.target_label = ANY(events.audience_relationship_types))))`
        );
        params.push(filters.discoveryUserId);
        paramIndex++;
      }
      if (visParts.length === 0) {
        conditions.push('1 = 0'); // cliente pediu visibility fora da discovery (only_me) ou connections sem user
      } else {
        conditions.push(`(${visParts.join(' OR ')})`);
      }
    } else if (filters.visibilityMode === 'organizer_dashboard') {
      // SEM piso público — mas dashboard SÓ existe atrelado a um organizer (a rota só ativa este modo após
      // canRepresentActor(organizerActorId), ou uma lista já resolvida via organizerActorIds — mesma
      // garantia, plural). Defesa: sem nenhum dos dois → nunca devolve nada (1 = 0).
      if (!filters.organizerActorId && !(filters.organizerActorIds && filters.organizerActorIds.length > 0)) {
        conditions.push('1 = 0');
      } else {
        // organizerActorId/organizerActorIds já restringiu actor_id acima. Cliente estreita por status/visibility livremente.
        if (filters.status) {
          conditions.push(`status = $${paramIndex}`);
          params.push(sprint76StatusToDb(filters.status));
          paramIndex++;
        }
        if (filters.visibility) {
          conditions.push(`visibility = $${paramIndex}`);
          params.push(filters.visibility);
          paramIndex++;
        }
      }
    } else if (filters.status) {
      // INTERNO (default, ex.: my-orders) — comportamento anterior, sem piso.
      conditions.push(`status = $${paramIndex}`);
      params.push(sprint76StatusToDb(filters.status));
      paramIndex++;
    }

    if (filters.startAtFrom) {
      const dateFrom = filters.startAtFrom instanceof Date ? filters.startAtFrom : new Date(filters.startAtFrom);
      conditions.push(`datetime_start >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (filters.startAtTo) {
      const dateTo = filters.startAtTo instanceof Date ? filters.startAtTo : new Date(filters.startAtTo);
      conditions.push(`datetime_start <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<EventRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, actor_type, event_type, event_subtype,
             title, description, datetime_start, datetime_end, timezone,
             status, visibility, ticket_price_cents, max_attendees, currency,
             metadata, created_at, updated_at
      FROM events
      WHERE ${conditions.join(' AND ')}
      ORDER BY datetime_start ASC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toEvent(row));
  }
}

export const eventRepository = new EventRepository();
