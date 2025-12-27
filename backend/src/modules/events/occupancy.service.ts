// src/modules/events/occupancy.service.ts
// Service para gerenciar modelos de ocupação de eventos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  EventOccupancyModel,
  CreateOccupancyModelInput,
  OccupancyModelSuggestion,
  EventReservation,
  CreateReservationInput,
} from './occupancy.types';

interface OccupancyModelRow {
  id: string;
  event_id: string;
  tenant_id: string;
  occupancy_type: string;
  total_capacity: number | null;
  requires_reservation: boolean;
  reservation_price_cents: number | null;
  reservation_currency: string;
  no_show_penalty_cents: number | null;
  no_show_penalty_currency: string;
  auto_cancel_after_minutes: number | null;
  config: any;
  created_at: Date;
  updated_at: Date;
}

interface ReservationRow {
  id: string;
  event_id: string;
  tenant_id: string;
  occupancy_model_id: string;
  global_user_id: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  status: string;
  reservation_price_cents: number | null;
  reservation_currency: string;
  transaction_id: string | null;
  check_in_time: Date | null;
  no_show_time: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export class OccupancyService {
  /**
   * Cria ou atualiza modelo de ocupação para um evento
   */
  async createOrUpdateOccupancyModel(
    tenantId: string,
    input: CreateOccupancyModelInput
  ): Promise<EventOccupancyModel> {
    // Verificar se já existe
    const existing = await runQueryWithTenant<OccupancyModelRow>(
      tenantId,
      `
      SELECT * FROM event_occupancy_models
      WHERE event_id = $1
      LIMIT 1
      `,
      [input.event_id]
    );

    if (existing) {
      // Atualizar
      const updated = await runQueryWithTenant<OccupancyModelRow>(
        tenantId,
        `
        UPDATE event_occupancy_models
        SET
          occupancy_type = $2,
          total_capacity = $3,
          requires_reservation = $4,
          reservation_price_cents = $5,
          reservation_currency = COALESCE($6, 'BRL'),
          no_show_penalty_cents = $7,
          no_show_penalty_currency = COALESCE($8, 'BRL'),
          auto_cancel_after_minutes = $9,
          config = $10::jsonb,
          updated_at = now()
        WHERE id = $11
        RETURNING *
        `,
        [
          input.occupancy_type,
          input.total_capacity || null,
          input.requires_reservation ?? false,
          input.reservation_price_cents ? Math.round(input.reservation_price_cents * 100) : null,
          input.reservation_currency,
          input.no_show_penalty_cents ? Math.round(input.no_show_penalty_cents * 100) : null,
          input.no_show_penalty_currency,
          input.auto_cancel_after_minutes || null,
          JSON.stringify(input.config),
          existing.id,
        ]
      );

      if (!updated) {
        throw new Error('Erro ao atualizar modelo de ocupação');
      }

      return this.toOccupancyModel(updated);
    } else {
      // Criar novo
      // Buscar tenant_id do evento
      const event = await runQueryWithTenant<{ tenant_id: string }>(
        tenantId,
        `
        SELECT tenant_id FROM events WHERE id = $1 LIMIT 1
        `,
        [input.event_id]
      );

      if (!event) {
        throw new Error('Evento não encontrado');
      }

      const created = await runQueryWithTenant<OccupancyModelRow>(
        tenantId,
        `
        INSERT INTO event_occupancy_models (
          event_id, tenant_id, occupancy_type, total_capacity,
          requires_reservation, reservation_price_cents, reservation_currency,
          no_show_penalty_cents, no_show_penalty_currency,
          auto_cancel_after_minutes, config
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        RETURNING *
        `,
        [
          input.event_id,
          event.tenant_id,
          input.occupancy_type,
          input.total_capacity || null,
          input.requires_reservation ?? false,
          input.reservation_price_cents ? Math.round(input.reservation_price_cents * 100) : null,
          input.reservation_currency || 'BRL',
          input.no_show_penalty_cents ? Math.round(input.no_show_penalty_cents * 100) : null,
          input.no_show_penalty_currency || 'BRL',
          input.auto_cancel_after_minutes || null,
          JSON.stringify(input.config),
        ]
      );

      if (!created) {
        throw new Error('Erro ao criar modelo de ocupação');
      }

      return this.toOccupancyModel(created);
    }
  }

  /**
   * Busca modelo de ocupação de um evento
   */
  async getOccupancyModel(
    tenantId: string,
    eventId: string
  ): Promise<EventOccupancyModel | null> {
    const row = await runQueryWithTenant<OccupancyModelRow>(
      tenantId,
      `
      SELECT * FROM event_occupancy_models
      WHERE event_id = $1
      LIMIT 1
      `,
      [eventId]
    );

    return row ? this.toOccupancyModel(row) : null;
  }

  /**
   * Cria reserva de recurso
   */
  async createReservation(
    tenantId: string,
    globalUserId: string,
    input: CreateReservationInput
  ): Promise<EventReservation> {
    // Buscar modelo de ocupação
    const model = await this.getOccupancyModel(tenantId, input.event_id);
    if (!model) {
      throw new Error('Modelo de ocupação não encontrado para este evento');
    }

    // Buscar tenant_id do evento
    const event = await runQueryWithTenant<{ tenant_id: string }>(
      tenantId,
      `
      SELECT tenant_id FROM events WHERE id = $1 LIMIT 1
      `,
      [input.event_id]
    );

    if (!event) {
      throw new Error('Evento não encontrado');
    }

    const created = await runQueryWithTenant<ReservationRow>(
      tenantId,
      `
      INSERT INTO event_reservations (
        event_id, tenant_id, occupancy_model_id, global_user_id,
        resource_type, resource_id, resource_name,
        status, reservation_price_cents, reservation_currency
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9)
      RETURNING *
      `,
      [
        input.event_id,
        event.tenant_id,
        model.id,
        globalUserId,
        input.resource_type,
        input.resource_id || null,
        input.resource_name || null,
        input.reservation_price_cents ? Math.round(input.reservation_price_cents * 100) : null,
        'BRL',
      ]
    );

    if (!created) {
      throw new Error('Erro ao criar reserva');
    }

    return this.toReservation(created);
  }

  /**
   * Busca estatísticas de ocupação de um evento
   */
  async getOccupancyStats(
    tenantId: string,
    eventId: string
  ): Promise<{
    total_capacity: number | null;
    total_reservations: number;
    confirmed_reservations: number;
    checked_in: number;
    no_shows: number;
    available: number | null;
  }> {
    const model = await this.getOccupancyModel(tenantId, eventId);
    if (!model) {
      return {
        total_capacity: null,
        total_reservations: 0,
        confirmed_reservations: 0,
        checked_in: 0,
        no_shows: 0,
        available: null,
      };
    }

    const stats = await runQueryWithTenant<{
      total: string;
      confirmed: string;
      checked_in: string;
      no_shows: string;
    }>(
      tenantId,
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED' OR status = 'CHECKED_IN') as confirmed,
        COUNT(*) FILTER (WHERE status = 'CHECKED_IN') as checked_in,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW') as no_shows
      FROM event_reservations
      WHERE event_id = $1
      `,
      [eventId]
    );

    const totalReservations = parseInt(stats?.total || '0', 10);
    const confirmed = parseInt(stats?.confirmed || '0', 10);
    const checkedIn = parseInt(stats?.checked_in || '0', 10);
    const noShows = parseInt(stats?.no_shows || '0', 10);
    const available = model.total_capacity ? model.total_capacity - confirmed : null;

    return {
      total_capacity: model.total_capacity,
      total_reservations: totalReservations,
      confirmed_reservations: confirmed,
      checked_in: checkedIn,
      no_shows: noShows,
      available,
    };
  }

  private toOccupancyModel(row: OccupancyModelRow): EventOccupancyModel {
    return {
      id: row.id,
      event_id: row.event_id,
      tenant_id: row.tenant_id,
      occupancy_type: row.occupancy_type as any,
      total_capacity: row.total_capacity,
      requires_reservation: row.requires_reservation,
      reservation_price_cents: row.reservation_price_cents,
      reservation_currency: row.reservation_currency,
      no_show_penalty_cents: row.no_show_penalty_cents,
      no_show_penalty_currency: row.no_show_penalty_currency,
      auto_cancel_after_minutes: row.auto_cancel_after_minutes,
      config: row.config,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private toReservation(row: ReservationRow): EventReservation {
    return {
      id: row.id,
      event_id: row.event_id,
      tenant_id: row.tenant_id,
      occupancy_model_id: row.occupancy_model_id,
      global_user_id: row.global_user_id,
      resource_type: row.resource_type as any,
      resource_id: row.resource_id,
      resource_name: row.resource_name,
      status: row.status as any,
      reservation_price_cents: row.reservation_price_cents,
      reservation_currency: row.reservation_currency,
      transaction_id: row.transaction_id,
      check_in_time: row.check_in_time,
      no_show_time: row.no_show_time,
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const occupancyService = new OccupancyService();













