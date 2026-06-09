// backend/src/core/calendar/unified-calendar.service.ts
// 🔴 READ-MODEL
// NÃO usar para decisões.
// Fonte canônica: unified-availability.service.ts
// Service para AGENDA UNIFICADA
// Consolida todas as fontes de agenda em uma única visão

import { runQueriesWithTenant } from '@core/database/pool';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
// 🔴 CORREÇÃO FASE 1: Removidas referências a calendarService e serviceAvailabilityRepository
// Toda lógica temporal agora usa Unified Availability
import type {
  UnifiedCalendarEntry,
  UnifiedCalendarFilters,
} from './unified-calendar.types';
import {
  CalendarEntrySource,
  CalendarEntryType,
} from './unified-calendar.types';

/**
 * Service para Agenda Unificada
 * 
 * REGRAS:
 * - NÃO duplica dados
 * - Backend continua sendo source of truth
 * - Frontend apenas consolida e exibe
 * - Tudo que aparece deve dizer DE ONDE vem
 */
class UnifiedCalendarService {
  /**
   * Busca agenda unificada consolidando todas as fontes
   * 
   * 🔴 CORREÇÃO FASE 1: Fontes consultadas agora são apenas:
   * 1. unified_availability (availability unificada - Core Temporal)
   * 2. events (eventos do sistema - referenciam Unified Availability)
   * 
   * Removidas fontes paralelas:
   * - service_availability (consolidado em unified_availability)
   * - calendar_events (consolidado em unified_availability)
   */
  async getUnifiedCalendar(
    tenantId: string,
    filters: UnifiedCalendarFilters = {}
  ): Promise<UnifiedCalendarEntry[]> {
    const entries: UnifiedCalendarEntry[] = [];

    // 1. Buscar de unified_availability (Core Temporal)
    if (!filters.source || filters.source === CalendarEntrySource.UNIFIED_AVAILABILITY) {
      const unifiedAvailabilities = await this.getUnifiedAvailabilities(tenantId, filters);
      entries.push(...unifiedAvailabilities);
    }

    // 2. Buscar de events (referenciam Unified Availability)
    if (!filters.source || filters.source === CalendarEntrySource.EVENT) {
      const events = await this.getEvents(tenantId, filters);
      entries.push(...events);
    }

    // 5. Ordenar por startTime
    entries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // 6. Aplicar limite e offset
    const offset = filters.offset || 0;
    const limit = filters.limit || 1000;
    
    return entries.slice(offset, offset + limit);
  }

  // 🔴 CORREÇÃO FASE 1: Removidos métodos getServiceAvailabilities e getCalendarEvents
  // Essas fontes foram consolidadas em Unified Availability

  /**
   * Busca disponibilidades unificadas
   */
  private async getUnifiedAvailabilities(
    tenantId: string,
    filters: UnifiedCalendarFilters
  ): Promise<UnifiedCalendarEntry[]> {
    // 🔴 DECISION-0113: a agenda de availability é escopada pelo actor dono.
    // Mapeamento confirmado de 1ª mão (DB vivo): `availability.owner_id = actors.id` (actorId) —
    // 32/32 owner_id casam com actors, owner_type='user' → actor_type='user'. O TODO antigo
    // ("assumindo que actorId pode ser userId") está resolvido: owner_id É o actorId.
    const params: any[] = [tenantId];
    let paramIndex = 2;

    let ownerFilter = '';
    if (filters.actorId) {
      ownerFilter = `AND owner_id = $${paramIndex++}`;
      params.push(filters.actorId);
    }

    let fromFilter = '';
    if (filters.startTimeFrom) {
      fromFilter = `AND end_datetime >= $${paramIndex++}`;
      params.push(filters.startTimeFrom);
    }

    let toFilter = '';
    if (filters.startTimeTo) {
      toFilter = `AND start_datetime <= $${paramIndex++}`;
      params.push(filters.startTimeTo);
    }

    const query = `
      SELECT
        availability_id,
        owner_type,
        owner_id,
        start_datetime,
        end_datetime,
        timezone,
        status,
        capacity,
        metadata,
        created_at,
        updated_at
      FROM availability
      WHERE tenant_id = $1
        AND status = 'active'
        ${ownerFilter}
        ${fromFilter}
        ${toFilter}
      ORDER BY start_datetime ASC
    `;

    const rows = await runQueriesWithTenant<any>(tenantId, query, params);

    return rows.map((row) => {
      // Determinar tipo baseado no status
      const type = row.status === 'active' 
        ? CalendarEntryType.AVAILABLE 
        : CalendarEntryType.UNAVAILABLE;

      return {
        id: `unified_availability:${row.availability_id}`,
        source: CalendarEntrySource.UNIFIED_AVAILABILITY,
        sourceId: row.availability_id,
        type,
        startTime: row.start_datetime,
        endTime: row.end_datetime,
        timezone: row.timezone || 'America/Sao_Paulo',
        title: `Disponibilidade (${row.owner_type})`,
        description: `Owner: ${row.owner_id.substring(0, 8)}...`,
        availabilityId: row.availability_id,
        sourceStatus: row.status,
        metadata: {
          ...row.metadata,
          ownerType: row.owner_type,
          ownerId: row.owner_id,
          capacity: row.capacity,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  /**
   * Busca eventos do sistema
   */
  private async getEvents(
    tenantId: string,
    filters: UnifiedCalendarFilters
  ): Promise<UnifiedCalendarEntry[]> {
    // Buscar eventos do módulo de eventos
    let query = `
      SELECT 
        id,
        actor_id,
        title,
        description,
        datetime_start,
        datetime_end,
        timezone,
        status,
        metadata,
        created_at,
        updated_at
      FROM events
      WHERE tenant_id = $1
        AND status IN ('published', 'draft')
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.eventId) {
      query += ` AND id = $${paramIndex++}`;
      params.push(filters.eventId);
    }

    if (filters.actorId) {
      query += ` AND actor_id = $${paramIndex++}`;
      params.push(filters.actorId);
    }

    if (filters.startTimeFrom) {
      query += ` AND datetime_end >= $${paramIndex++}`;
      params.push(filters.startTimeFrom);
    }

    if (filters.startTimeTo) {
      query += ` AND datetime_start <= $${paramIndex++}`;
      params.push(filters.startTimeTo);
    }

    query += ` ORDER BY datetime_start ASC`;

    const rows = await runQueriesWithTenant<any>(tenantId, query, params);

    return rows.map((row) => ({
      id: `event:${row.id}`,
      source: CalendarEntrySource.EVENT,
      sourceId: row.id,
      type: CalendarEntryType.RESERVED, // Eventos são considerados reservados
      startTime: row.datetime_start instanceof Date ? row.datetime_start : new Date(row.datetime_start),
      endTime: row.datetime_end instanceof Date ? row.datetime_end : new Date(row.datetime_end),
      timezone: row.timezone || 'America/Sao_Paulo',
      title: row.title,
      description: row.description,
      actorId: row.actor_id,
      eventId: row.id,
      sourceStatus: row.status,
      metadata: {
        ...row.metadata,
      },
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    }));
  }
}

export const unifiedCalendarService = new UnifiedCalendarService();


