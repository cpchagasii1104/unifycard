// src/modules/cultural/cultural-event.service.ts
// Serviço para Eventos Culturais - FASE 16
// REGRA: Evento não é só post, é entidade própria com ciclo de vida completo

import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { authService } from '@core/auth/auth.service';

export type EventType =
  | 'SHOW'
  | 'OFICINA'
  | 'FESTIVAL'
  | 'RODA'
  | 'AULA'
  | 'EXPOSICAO'
  | 'DEBATE'
  | 'INTERVENCAO';

export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface RevenueSplit {
  target_type: 'CULTURAL_PROFILE' | 'REGION' | 'FUND';
  target_id: string;
  percentage: number;
}

export interface CulturalEvent {
  id: string;
  tenant_id: string;
  created_by_cultural_profile_id: string;
  co_creators_cultural_profile_ids: string[];
  event_type: EventType;
  title: string;
  description: string | null;
  datetime_start: string;
  datetime_end: string;
  location_cultural_profile_id: string | null;
  status: EventStatus;
  visibility: 'PUBLIC' | 'LOCAL' | 'PRIVATE';
  ticket_price_cents: number | null;
  max_attendees: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateCulturalEventInput {
  created_by_cultural_profile_id: string;
  co_creators_cultural_profile_ids?: string[];
  event_type: EventType;
  title: string;
  description?: string;
  datetime_start: string;
  datetime_end: string;
  location_cultural_profile_id?: string;
  visibility?: 'PUBLIC' | 'LOCAL' | 'PRIVATE';
  ticket_price_cents?: number;
  max_attendees?: number;
  revenue_split: RevenueSplit[]; // Deve somar 100
}

class CulturalEventService {
  /**
   * Valida split percentual (deve somar 100)
   */
  private validateRevenueSplit(split: RevenueSplit[]): void {
    const total = split.reduce((sum, s) => sum + s.percentage, 0);
    if (total !== 100) {
      throw new Error(`Split percentual deve somar 100% (atual: ${total}%)`);
    }

    // Validar percentuais válidos
    for (const s of split) {
      if (s.percentage < 0 || s.percentage > 100) {
        throw new Error(`Percentual inválido: ${s.percentage}%`);
      }
    }
  }

  /**
   * Cria evento cultural (DRAFT)
   */
  async createEvent(
    tenantId: string,
    input: CreateCulturalEventInput
  ): Promise<CulturalEvent> {
    // Validar split
    this.validateRevenueSplit(input.revenue_split);

    // Validar que criador existe e está ativo
    const creator = await runQueryWithTenant<{
      id: string;
      type: string;
      active: boolean;
    }>(
      tenantId,
      `
      SELECT id, type, active
      FROM cultural_profiles
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [input.created_by_cultural_profile_id, tenantId]
    );

    if (!creator || creator.length === 0 || !creator[0].active) {
      throw new Error('Perfil cultural criador não encontrado ou inativo');
    }

    // Validar datas
    const startDate = new Date(input.datetime_start);
    const endDate = new Date(input.datetime_end);
    if (endDate <= startDate) {
      throw new Error('Data/hora de término deve ser posterior à de início');
    }

    // Validar local (se fornecido)
    if (input.location_cultural_profile_id) {
      const location = await runQueryWithTenant<{
        id: string;
        type: string;
        active: boolean;
      }>(
        tenantId,
        `
        SELECT id, type, active
        FROM cultural_profiles
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [input.location_cultural_profile_id, tenantId]
      );

      if (!location || location.length === 0 || !location[0].active) {
        throw new Error('Perfil cultural local não encontrado ou inativo');
      }

      // Validar que local pode hospedar
      const validHostTypes = ['BAR', 'VENUE', 'CIRCLE', 'COLLECTIVE'];
      if (!validHostTypes.includes(location[0].type)) {
        throw new Error('Perfil cultural local não pode hospedar eventos');
      }
    }

    // Criar evento
    const eventId = randomUUID();
    const result = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      created_by_cultural_profile_id: string;
      co_creators_cultural_profile_ids: string[];
      event_type: string;
      title: string;
      description: string | null;
      datetime_start: string;
      datetime_end: string;
      location_cultural_profile_id: string | null;
      status: string;
      visibility: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      tenantId,
      `
      INSERT INTO cultural_events (
        id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
        event_type, title, description, datetime_start, datetime_end,
        location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
                event_type, title, description, datetime_start, datetime_end,
                location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
                created_at, updated_at, completed_at
      `,
      [
        eventId,
        tenantId,
        input.created_by_cultural_profile_id,
        input.co_creators_cultural_profile_ids || [],
        input.event_type,
        input.title,
        input.description || null,
        input.datetime_start,
        input.datetime_end,
        input.location_cultural_profile_id || null,
        'DRAFT',
        input.visibility || 'PUBLIC',
        input.ticket_price_cents || null,
        input.max_attendees || null,
      ]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao criar evento cultural');
    }

    // Criar splits de receita
    await runQueriesWithTenant(
      tenantId,
      input.revenue_split.map((split) => ({
        query: `
          INSERT INTO event_revenue_split (
            tenant_id, event_id, target_type, target_id, percentage
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        params: [
          tenantId,
          eventId,
          split.target_type,
          split.target_id,
          split.percentage,
        ],
      }))
    );

    const row = result[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      created_by_cultural_profile_id: row.created_by_cultural_profile_id,
      co_creators_cultural_profile_ids: row.co_creators_cultural_profile_ids || [],
      event_type: row.event_type as EventType,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      location_cultural_profile_id: row.location_cultural_profile_id,
      status: row.status as EventStatus,
      visibility: row.visibility as 'PUBLIC' | 'LOCAL' | 'PRIVATE',
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  /**
   * Publica evento (DRAFT → PUBLISHED)
   */
  async publishEvent(
    tenantId: string,
    eventId: string
  ): Promise<CulturalEvent> {
    // Validar que evento existe e está em DRAFT
    const event = await runQueryWithTenant<{
      id: string;
      status: string;
      created_by_cultural_profile_id: string;
    }>(
      tenantId,
      `
      SELECT id, status, created_by_cultural_profile_id
      FROM cultural_events
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [eventId, tenantId]
    );

    if (!event || event.length === 0) {
      throw new Error('Evento não encontrado');
    }

    if (event[0].status !== 'DRAFT') {
      throw new Error('Apenas eventos em DRAFT podem ser publicados');
    }

    // Atualizar status
    const result = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      created_by_cultural_profile_id: string;
      co_creators_cultural_profile_ids: string[];
      event_type: string;
      title: string;
      description: string | null;
      datetime_start: string;
      datetime_end: string;
      location_cultural_profile_id: string | null;
      status: string;
      visibility: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      tenantId,
      `
      UPDATE cultural_events
      SET status = 'PUBLISHED', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
                event_type, title, description, datetime_start, datetime_end,
                location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
                created_at, updated_at, completed_at
      `,
      [eventId, tenantId]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao publicar evento');
    }

    const row = result[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      created_by_cultural_profile_id: row.created_by_cultural_profile_id,
      co_creators_cultural_profile_ids: row.co_creators_cultural_profile_ids || [],
      event_type: row.event_type as EventType,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      location_cultural_profile_id: row.location_cultural_profile_id,
      status: row.status as EventStatus,
      visibility: row.visibility as 'PUBLIC' | 'LOCAL' | 'PRIVATE',
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  /**
   * Local confirma evento (PUBLISHED → CONFIRMED)
   */
  async confirmLocation(
    tenantId: string,
    eventId: string,
    locationProfileId: string
  ): Promise<CulturalEvent> {
    // Validar que evento existe e está em PUBLISHED
    const event = await runQueryWithTenant<{
      id: string;
      status: string;
      location_cultural_profile_id: string | null;
    }>(
      tenantId,
      `
      SELECT id, status, location_cultural_profile_id
      FROM cultural_events
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [eventId, tenantId]
    );

    if (!event || event.length === 0) {
      throw new Error('Evento não encontrado');
    }

    if (event[0].status !== 'PUBLISHED') {
      throw new Error('Apenas eventos PUBLISHED podem ser confirmados por local');
    }

    // Validar que local existe e pode hospedar
    const location = await runQueryWithTenant<{
      id: string;
      type: string;
      active: boolean;
    }>(
      tenantId,
      `
      SELECT id, type, active
      FROM cultural_profiles
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [locationProfileId, tenantId]
    );

    if (!location || location.length === 0 || !location[0].active) {
      throw new Error('Perfil cultural local não encontrado ou inativo');
    }

    const validHostTypes = ['BAR', 'VENUE', 'CIRCLE', 'COLLECTIVE'];
    if (!validHostTypes.includes(location[0].type)) {
      throw new Error('Perfil cultural local não pode hospedar eventos');
    }

    // Atualizar status e local
    const result = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      created_by_cultural_profile_id: string;
      co_creators_cultural_profile_ids: string[];
      event_type: string;
      title: string;
      description: string | null;
      datetime_start: string;
      datetime_end: string;
      location_cultural_profile_id: string | null;
      status: string;
      visibility: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      tenantId,
      `
      UPDATE cultural_events
      SET status = 'CONFIRMED',
          location_cultural_profile_id = $3,
          updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
                event_type, title, description, datetime_start, datetime_end,
                location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
                created_at, updated_at, completed_at
      `,
      [eventId, tenantId, locationProfileId]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao confirmar local');
    }

    const row = result[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      created_by_cultural_profile_id: row.created_by_cultural_profile_id,
      co_creators_cultural_profile_ids: row.co_creators_cultural_profile_ids || [],
      event_type: row.event_type as EventType,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      location_cultural_profile_id: row.location_cultural_profile_id,
      status: row.status as EventStatus,
      visibility: row.visibility as 'PUBLIC' | 'LOCAL' | 'PRIVATE',
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  /**
   * Completa evento (CONFIRMED → COMPLETED)
   * FASE 16: Gera impacto simbólico (sem dinheiro ainda)
   */
  async completeEvent(
    tenantId: string,
    eventId: string
  ): Promise<CulturalEvent> {
    // Validar que evento existe e está em CONFIRMED ou PUBLISHED
    const event = await runQueryWithTenant<{
      id: string;
      status: string;
      created_by_cultural_profile_id: string;
      location_cultural_profile_id: string | null;
    }>(
      tenantId,
      `
      SELECT id, status, created_by_cultural_profile_id, location_cultural_profile_id
      FROM cultural_events
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [eventId, tenantId]
    );

    if (!event || event.length === 0) {
      throw new Error('Evento não encontrado');
    }

    if (event[0].status !== 'CONFIRMED' && event[0].status !== 'PUBLISHED') {
      throw new Error('Apenas eventos CONFIRMED ou PUBLISHED podem ser completados');
    }

    // Atualizar status
    const result = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      created_by_cultural_profile_id: string;
      co_creators_cultural_profile_ids: string[];
      event_type: string;
      title: string;
      description: string | null;
      datetime_start: string;
      datetime_end: string;
      location_cultural_profile_id: string | null;
      status: string;
      visibility: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      tenantId,
      `
      UPDATE cultural_events
      SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
                event_type, title, description, datetime_start, datetime_end,
                location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
                created_at, updated_at, completed_at
      `,
      [eventId, tenantId]
    );

    if (!result || result.length === 0) {
      throw new Error('Erro ao completar evento');
    }

    const row = result[0];

    // FASE 16: Gerar impacto simbólico (não crítico)
    try {
      // Buscar PAC criador para obter owner_actor
      const creatorProfile = await runQueryWithTenant<{
        owner_actor_id: string;
        owner_actor_type: string;
      }>(
        tenantId,
        `
        SELECT owner_actor_id, owner_actor_type
        FROM cultural_profiles
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [row.created_by_cultural_profile_id, tenantId]
      );

      if (creatorProfile && creatorProfile.length > 0) {
        const { impactService } = await import('@modules/social/impact.service');
        await impactService.recordImpact(
          tenantId,
          {
            actor_id: creatorProfile[0].owner_actor_id,
            actor_type: creatorProfile[0].owner_actor_type as 'user' | 'page',
          },
          'POST_PUBLISHED', // Reutilizar tipo existente por enquanto (FASE 16: impacto simbólico)
          5, // +5 impacto por evento completado
          'cultural_event',
          eventId,
          {
            event_type: row.event_type,
            cultural_profile_id: row.created_by_cultural_profile_id,
          }
        );
      }
    } catch (err) {
      console.warn('Erro ao gerar impacto de evento completado (não crítico):', err);
    }

    // FASE 13: Registrar evento de auditoria (não crítico)
    try {
      const { auditService } = await import('@core/audit/audit.service');
      const creatorProfile = await runQueryWithTenant<{
        owner_actor_id: string;
        owner_actor_type: string;
      }>(
        tenantId,
        `
        SELECT owner_actor_id, owner_actor_type
        FROM cultural_profiles
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [row.created_by_cultural_profile_id, tenantId]
      );
      
      await auditService.record(tenantId, {
        event_type: 'EVENT_COMPLETED',
        severity: 'LOW',
        actor_id: creatorProfile?.[0]?.owner_actor_id,
        actor_type: creatorProfile?.[0]?.owner_actor_type as 'user' | 'page' | undefined,
        source: 'social',
        context: {
          event_id: eventId,
          event_type: row.event_type,
          cultural_profile_id: row.created_by_cultural_profile_id,
        },
      });
    } catch (err) {
      console.warn('Erro ao registrar auditoria de evento (não crítico):', err);
    }

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      created_by_cultural_profile_id: row.created_by_cultural_profile_id,
      co_creators_cultural_profile_ids: row.co_creators_cultural_profile_ids || [],
      event_type: row.event_type as EventType,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      location_cultural_profile_id: row.location_cultural_profile_id,
      status: row.status as EventStatus,
      visibility: row.visibility as 'PUBLIC' | 'LOCAL' | 'PRIVATE',
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  /**
   * Busca evento por ID
   */
  async getEvent(
    tenantId: string,
    eventId: string
  ): Promise<CulturalEvent | null> {
    const result = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      created_by_cultural_profile_id: string;
      co_creators_cultural_profile_ids: string[];
      event_type: string;
      title: string;
      description: string | null;
      datetime_start: string;
      datetime_end: string;
      location_cultural_profile_id: string | null;
      status: string;
      visibility: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      tenantId,
      `
      SELECT id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
             event_type, title, description, datetime_start, datetime_end,
             location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
             created_at, updated_at, completed_at
      FROM cultural_events
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [eventId, tenantId]
    );

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      created_by_cultural_profile_id: row.created_by_cultural_profile_id,
      co_creators_cultural_profile_ids: row.co_creators_cultural_profile_ids || [],
      event_type: row.event_type as EventType,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      location_cultural_profile_id: row.location_cultural_profile_id,
      status: row.status as EventStatus,
      visibility: row.visibility as 'PUBLIC' | 'LOCAL' | 'PRIVATE',
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  /**
   * Lista eventos públicos
   */
  async listPublicEvents(
    tenantId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<{ events: CulturalEvent[]; next_cursor: string | null }> {
    const query = cursor
      ? `
      SELECT id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
             event_type, title, description, datetime_start, datetime_end,
             location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
             created_at, updated_at, completed_at
      FROM cultural_events
      WHERE tenant_id = $1 
        AND visibility = 'PUBLIC'
        AND status IN ('PUBLISHED', 'CONFIRMED')
        AND id > $2
      ORDER BY datetime_start ASC
      LIMIT $3
      `
      : `
      SELECT id, tenant_id, created_by_cultural_profile_id, co_creators_cultural_profile_ids,
             event_type, title, description, datetime_start, datetime_end,
             location_cultural_profile_id, status, visibility, ticket_price_cents, max_attendees,
             created_at, updated_at, completed_at
      FROM cultural_events
      WHERE tenant_id = $1 
        AND visibility = 'PUBLIC'
        AND status IN ('PUBLISHED', 'CONFIRMED')
      ORDER BY datetime_start ASC
      LIMIT $2
      `;

    const result = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      created_by_cultural_profile_id: string;
      co_creators_cultural_profile_ids: string[];
      event_type: string;
      title: string;
      description: string | null;
      datetime_start: string;
      datetime_end: string;
      location_cultural_profile_id: string | null;
      status: string;
      visibility: string;
      ticket_price_cents: number | null;
      max_attendees: number | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      tenantId,
      query,
      cursor ? [tenantId, cursor, limit + 1] : [tenantId, limit + 1]
    );

    const events = (result || []).map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      created_by_cultural_profile_id: row.created_by_cultural_profile_id,
      co_creators_cultural_profile_ids: row.co_creators_cultural_profile_ids || [],
      event_type: row.event_type as EventType,
      title: row.title,
      description: row.description,
      datetime_start: row.datetime_start,
      datetime_end: row.datetime_end,
      location_cultural_profile_id: row.location_cultural_profile_id,
      status: row.status as EventStatus,
      visibility: row.visibility as 'PUBLIC' | 'LOCAL' | 'PRIVATE',
      ticket_price_cents: row.ticket_price_cents,
      max_attendees: row.max_attendees,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    }));

    const hasMore = events.length > limit;
    const finalEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && finalEvents.length > 0 ? finalEvents[finalEvents.length - 1].id : null;

    return {
      events: finalEvents,
      next_cursor: nextCursor,
    };
  }

  /**
   * Busca split de receita de um evento
   */
  async getEventRevenueSplit(
    tenantId: string,
    eventId: string
  ): Promise<RevenueSplit[]> {
    const result = await runQueryWithTenant<{
      target_type: string;
      target_id: string;
      percentage: number;
    }>(
      tenantId,
      `
      SELECT target_type, target_id, percentage
      FROM event_revenue_split
      WHERE tenant_id = $1 AND event_id = $2
      ORDER BY percentage DESC
      `,
      [tenantId, eventId]
    );

    return (result || []).map((row) => ({
      target_type: row.target_type as 'CULTURAL_PROFILE' | 'REGION' | 'FUND',
      target_id: row.target_id,
      percentage: row.percentage,
    }));
  }

  /**
   * FASE 17: Gera QR code de check-in para evento
   */
  async generateCheckInQR(
    tenantId: string,
    eventId: string
  ): Promise<{ qr_code: string; expires_at: string; event: CulturalEvent }> {
    // Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    // Validar que evento está publicado ou confirmado
    if (event.status !== 'PUBLISHED' && event.status !== 'CONFIRMED') {
      throw new Error('Evento deve estar PUBLISHED ou CONFIRMED para gerar QR code');
    }

    // Gerar JWT com expiração (datetime_end + 1h)
    const expiresAt = new Date(event.datetime_end);
    expiresAt.setHours(expiresAt.getHours() + 1);

    const payload = {
      event_id: eventId,
      tenant_id: tenantId,
      expires_at: expiresAt.toISOString(),
    };

    const secret = process.env.JWT_SECRET || 'unificard-secret-key-change-in-production';
    const qrCode = jwt.sign(payload, secret, { expiresIn: '1h' });

    return {
      qr_code: qrCode,
      expires_at: expiresAt.toISOString(),
      event,
    };
  }

  /**
   * FASE 17: Valida QR code de check-in
   */
  private async validateQRCode(qrCode: string, tenantId: string): Promise<{ event_id: string }> {
    try {
      // Usar authService para verificar JWT (centralizado)
      const decoded = authService.verifyJWT<{
        event_id: string;
        tenant_id: string;
        expires_at: string;
      }>(qrCode);

      // Validar tenant
      if (decoded.tenant_id !== tenantId) {
        throw new Error('QR code inválido para este tenant');
      }

      // Validar expiração (jwt.verify já valida expiração, mas mantemos validação explícita para clareza)
      const expiresAt = new Date(decoded.expires_at);
      if (new Date() > expiresAt) {
        throw new Error('QR code expirado');
      }

      return { event_id: decoded.event_id };
    } catch (err) {
      if (err instanceof Error && err.message.includes('Invalid or expired token')) {
        throw new Error('QR code inválido');
      }
      throw err;
    }
  }

  /**
   * FASE 17: Realiza check-in em evento cultural
   */
  async checkIn(
    tenantId: string,
    eventId: string,
    params: {
      actor_id: string;
      actor_type: 'user' | 'page' | 'cultural_profile';
      method: 'QR_CODE' | 'MANUAL' | 'AUTO';
      qr_code?: string;
      checked_in_by_actor_id?: string;
      checked_in_by_actor_type?: 'user' | 'page' | 'cultural_profile';
      geo?: { lat: number; lng: number };
      device_fingerprint?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{
    success: boolean;
    check_in: {
      id: string;
      event_id: string;
      actor_id: string;
      actor_type: string;
      check_in_time: string;
      method: string;
    };
    impact_generated: number;
  }> {
    // Buscar evento
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    // Validar método
    if (params.method === 'QR_CODE') {
      if (!params.qr_code) {
        throw new Error('QR code é obrigatório para método QR_CODE');
      }
      // Validar QR code
      const qrData = await this.validateQRCode(params.qr_code, tenantId);
      if (qrData.event_id !== eventId) {
        throw new Error('QR code não corresponde a este evento');
      }
    } else if (params.method === 'AUTO') {
      // Método AUTO: check-in direto sem validação adicional (MVP simplificado)
      // TODO: Adicionar validações adicionais (geo, device fingerprint) quando necessário
    } else if (params.method === 'MANUAL') {
      // Validar que quem está validando tem permissão
      if (!params.checked_in_by_actor_id || !params.checked_in_by_actor_type) {
        throw new Error('checked_in_by é obrigatório para método MANUAL');
      }
      // Verificar se é criador ou local do evento
      const canValidate = await this.canValidateCheckIn(
        tenantId,
        eventId,
        params.checked_in_by_actor_id,
        params.checked_in_by_actor_type
      );
      if (!canValidate) {
        throw new Error('Sem permissão para validar check-in manual');
      }
    }

    // Validar horário do evento
    const now = new Date();
    const eventStart = new Date(event.datetime_start);
    const eventEnd = new Date(event.datetime_end);
    const checkInStart = new Date(eventStart);
    checkInStart.setMinutes(checkInStart.getMinutes() - 30); // 30min antes
    const checkInEnd = new Date(eventEnd);
    checkInEnd.setHours(checkInEnd.getHours() + 1); // 1h depois

    if (now < checkInStart) {
      throw new Error('Check-in ainda não disponível (disponível 30min antes do evento)');
    }
    if (now > checkInEnd) {
      throw new Error('Check-in expirado (válido até 1h após o término)');
    }

    // Verificar se já fez check-in
    const existing = await runQueryWithTenant<{
      id: string;
      created_at: string;
    }>(
      tenantId,
      `
      SELECT id, created_at
      FROM cultural_event_checkins
      WHERE tenant_id = $1 
        AND event_id = $2 
        AND actor_id = $3 
        AND actor_type = $4
      LIMIT 1
      `,
      [tenantId, eventId, params.actor_id, params.actor_type]
    );

    if (existing) {
      throw new Error('Check-in já realizado para este evento');
    }

    // Inserir check-in
    const checkIn = await runQueryWithTenant<{
      id: string;
      created_at: string;
    }>(
      tenantId,
      `
      INSERT INTO cultural_event_checkins (
        tenant_id, event_id, actor_id, actor_type,
        checked_in_by_actor_id, checked_in_by_actor_type,
        check_in_method, geo_lat, geo_lng, device_fingerprint, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING id, created_at
      `,
      [
        tenantId,
        eventId,
        params.actor_id,
        params.actor_type,
        params.checked_in_by_actor_id || null,
        params.checked_in_by_actor_type || null,
        params.method,
        params.geo?.lat || null,
        params.geo?.lng || null,
        params.device_fingerprint || null,
        JSON.stringify(params.metadata || {}),
      ]
    );

    if (!checkIn) {
      throw new Error('Erro ao registrar check-in');
    }

    // Gerar impacto (+1) via impactService
    // Importar dinamicamente para evitar dependência circular
    const { impactService } = await import('../social/impact.service');
    await impactService.recordImpact({
      tenantId,
      actor: {
        actor_id: params.actor_id,
        actor_type: params.actor_type === 'cultural_profile' ? 'page' : params.actor_type, // Mapear cultural_profile para page temporariamente
      },
      eventType: 'SUPPORT', // Usar SUPPORT como tipo de evento de check-in (pode criar novo tipo depois)
      delta: 1,
      sourceType: 'system',
      sourceId: eventId,
      metadata: {
        event_title: event.title,
        event_type: event.event_type,
        check_in_method: params.method,
        check_in_id: checkIn.id,
      },
    });

    // Registrar em auditoria (opcional, mas recomendado)
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record({
        event_type: 'CULTURAL_EVENT_CHECKIN',
        severity: 'LOW',
        actor_id: params.actor_id,
        actor_type: params.actor_type,
        company_id: null,
        source: 'cultural_event_checkin',
        context: {
          event_id: eventId,
          check_in_method: params.method,
          geo_available: !!params.geo,
          device_fingerprint: params.device_fingerprint || null,
        },
      });
    } catch (auditErr) {
      // Não bloquear check-in se auditoria falhar
      console.warn('Erro ao registrar check-in em auditoria:', auditErr);
    }

    return {
      success: true,
      check_in: {
        id: checkIn.id,
        event_id: eventId,
        actor_id: params.actor_id,
        actor_type: params.actor_type,
        check_in_time: checkIn.created_at,
        method: params.method,
      },
      impact_generated: 1,
    };
  }

  /**
   * FASE 17: Verifica se ator pode validar check-in manual
   */
  private async canValidateCheckIn(
    tenantId: string,
    eventId: string,
    validatorActorId: string,
    validatorActorType: 'user' | 'page' | 'cultural_profile'
  ): Promise<boolean> {
    const event = await this.getEvent(tenantId, eventId);
    if (!event) return false;

    // Criador do evento pode validar
    if (validatorActorType === 'cultural_profile' && validatorActorId === event.created_by_cultural_profile_id) {
      return true;
    }

    // Local do evento pode validar
    if (event.location_cultural_profile_id && 
        validatorActorType === 'cultural_profile' && 
        validatorActorId === event.location_cultural_profile_id) {
      return true;
    }

    return false;
  }

  /**
   * EVENTOS ÂNCORA: Conta check-ins de um evento (leve, para eventos grandes)
   */
  async getCheckInCount(tenantId: string, eventId: string): Promise<number> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::text as count
      FROM cultural_event_checkins
      WHERE tenant_id = $1 AND event_id = $2
      `,
      [tenantId, eventId]
    );
    return parseInt(result?.count || '0', 10);
  }

  /**
   * FASE 17: Lista check-ins de um evento
   */
  async listCheckIns(
    tenantId: string,
    eventId: string,
    options: {
      limit?: number;
      cursor?: string;
      requesterActorId?: string;
      requesterActorType?: 'user' | 'page' | 'cultural_profile';
    } = {}
  ): Promise<{
    check_ins: Array<{
      id: string;
      actor_id: string;
      actor_type: string;
      actor_display_name: string;
      check_in_time: string;
      method: string;
      checked_in_by: { id: string; type: string; name: string } | null;
    }>;
    total: number;
    next_cursor: string | null;
  }> {
    const { limit = 50, cursor, requesterActorId, requesterActorType } = options;

    // Verificar permissões (criador/local vê todos, outros vêem apenas próprios)
    const event = await this.getEvent(tenantId, eventId);
    const canSeeAll = event && (
      (requesterActorType === 'cultural_profile' && requesterActorId === event.created_by_cultural_profile_id) ||
      (event.location_cultural_profile_id && requesterActorType === 'cultural_profile' && requesterActorId === event.location_cultural_profile_id)
    );

    // Query base
    let query = `
      SELECT 
        cec.id, cec.actor_id, cec.actor_type, cec.check_in_method,
        cec.checked_in_by_actor_id, cec.checked_in_by_actor_type,
        cec.created_at,
        COUNT(*) OVER() as total
      FROM cultural_event_checkins cec
      WHERE cec.tenant_id = $1 AND cec.event_id = $2
    `;

    const queryParams: any[] = [tenantId, eventId];

    // Filtro de permissão
    if (!canSeeAll && requesterActorId && requesterActorType) {
      query += ` AND cec.actor_id = $3 AND cec.actor_type = $4`;
      queryParams.push(requesterActorId, requesterActorType);
    }

    // Cursor pagination
    if (cursor) {
      query += ` AND cec.id > $${queryParams.length + 1}`;
      queryParams.push(cursor);
    }

    query += ` ORDER BY cec.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1);

    const result = await runQueryWithTenant<{
      id: string;
      actor_id: string;
      actor_type: string;
      check_in_method: string;
      checked_in_by_actor_id: string | null;
      checked_in_by_actor_type: string | null;
      created_at: string;
      total: number;
    }>(tenantId, query, queryParams);

    const total = result[0]?.total || 0;
    const hasMore = result.length > limit;
    const checkIns = result.slice(0, limit);

    // Buscar nomes dos atores (simplificado - pode melhorar depois)
    const checkInsWithNames = await Promise.all(
      checkIns.map(async (ci) => {
        // TODO: Buscar nome real do ator (user, page ou cultural_profile)
        // Por enquanto, retornar ID
        return {
          id: ci.id,
          actor_id: ci.actor_id,
          actor_type: ci.actor_type,
          actor_display_name: ci.actor_id, // Placeholder
          check_in_time: ci.created_at,
          method: ci.check_in_method,
          checked_in_by: ci.checked_in_by_actor_id
            ? {
                id: ci.checked_in_by_actor_id,
                type: ci.checked_in_by_actor_type || 'user',
                name: ci.checked_in_by_actor_id, // Placeholder
              }
            : null,
        };
      })
    );

    return {
      check_ins: checkInsWithNames,
      total: Number(total),
      next_cursor: hasMore ? checkIns[checkIns.length - 1].id : null,
    };
  }

  /**
   * FASE 17: Verifica status de check-in do usuário atual
   */
  async getCheckInStatus(
    tenantId: string,
    eventId: string,
    actorId: string,
    actorType: 'user' | 'page' | 'cultural_profile'
  ): Promise<{
    has_checked_in: boolean;
    check_in_time: string | null;
    method: string | null;
    can_check_in: boolean;
    event_status: EventStatus;
    event_datetime: {
      start: string;
      end: string;
    };
  }> {
    const event = await this.getEvent(tenantId, eventId);
    if (!event) {
      throw new Error('Evento não encontrado');
    }

    // Buscar check-in existente
    const checkIn = await runQueryWithTenant<{
      id: string;
      created_at: string;
      check_in_method: string;
    }>(
      tenantId,
      `
      SELECT id, created_at, check_in_method
      FROM cultural_event_checkins
      WHERE tenant_id = $1 
        AND event_id = $2 
        AND actor_id = $3 
        AND actor_type = $4
      LIMIT 1
      `,
      [tenantId, eventId, actorId, actorType]
    );

    const hasCheckedIn = !!checkIn;
    const now = new Date();
    const eventStart = new Date(event.datetime_start);
    const eventEnd = new Date(event.datetime_end);
    const checkInStart = new Date(eventStart);
    checkInStart.setMinutes(checkInStart.getMinutes() - 30);
    const checkInEnd = new Date(eventEnd);
    checkInEnd.setHours(checkInEnd.getHours() + 1);

    const canCheckIn = !hasCheckedIn && 
                       now >= checkInStart && 
                       now <= checkInEnd &&
                       (event.status === 'PUBLISHED' || event.status === 'CONFIRMED');

    return {
      has_checked_in: hasCheckedIn,
      check_in_time: checkIn?.created_at || null,
      method: checkIn?.check_in_method || null,
      can_check_in: canCheckIn,
      event_status: event.status,
      event_datetime: {
        start: event.datetime_start,
        end: event.datetime_end,
      },
    };
  }
}

export const culturalEventService = new CulturalEventService();

