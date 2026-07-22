// backend/src/modules/events/event-ticket.repository.ts
// SPRINT 76: Repository para event_tickets (catálogo de TIPO de ingresso)
//
// F-EVENT-TICKETING-CONVERGENCE · FATIA 1: convergido ao schema VIVO (migration
// 20260530120000_event_tickets.sql). A migration NÃO tem `quantity_sold` — tem
// `quantity_available` (NOT NULL, sem default). O código anterior mirava um schema
// ARQUIVADO (nunca aplicado) e toda query estourava "coluna não existe". O campo público
// `EventTicket.quantitySold` é preservado (consumido por ticket.service.ts na Fatia 2,
// fora de escopo aqui) como PROJEÇÃO DERIVADA honesta: quantityTotal - quantityAvailable —
// nenhuma coluna fantasma é lida/escrita. Bank-free: price_cents é valor ANUNCIADO, nunca
// cobrado por este repositório.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { EventTicket, CreateEventTicketInput } from './event.types';

interface EventTicketRow {
  id: string;
  tenant_id: string;
  event_id: string;
  ticket_type: string;
  price_cents: number;
  currency: string;
  quantity_total: number;
  quantity_available: number;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateEventTicketInput {
  priceCents?: number;
  currency?: string;
  quantityTotal?: number;
  metadata?: Record<string, any>;
}

class EventTicketRepository {
  private toEventTicket(row: EventTicketRow): EventTicket {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventId: row.event_id,
      ticketType: row.ticket_type as any,
      priceCents: row.price_cents,
      currency: row.currency,
      quantityTotal: row.quantity_total,
      // Derivado da coluna real quantity_available — nunca lido de quantity_sold (não existe).
      quantitySold: row.quantity_total - row.quantity_available,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /** Cria tipo de ingresso. quantity_available inicia = quantity_total (nenhuma venda ainda). */
  async createTicket(
    tenantId: string,
    eventId: string,
    input: CreateEventTicketInput,
    createdByActorId: string,
    createdByUserId: string | null
  ): Promise<EventTicket> {
    const row = await runQueryWithTenant<EventTicketRow>(
      tenantId,
      `
      INSERT INTO event_tickets (
        tenant_id, event_id, ticket_type, price_cents, currency,
        quantity_total, quantity_available, created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9::jsonb)
      RETURNING id, tenant_id, event_id, ticket_type, price_cents, currency,
                quantity_total, quantity_available, created_by_actor_id, created_by_user_id,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        eventId,
        input.ticketType,
        input.priceCents,
        input.currency || 'BRL',
        input.quantityTotal,
        createdByActorId,
        createdByUserId,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar tipo de ingresso');
    }

    return this.toEventTicket(row);
  }

  async getTicketById(tenantId: string, ticketId: string): Promise<EventTicket | null> {
    const rows = await runQueriesWithTenant<EventTicketRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_id, ticket_type, price_cents, currency,
             quantity_total, quantity_available, created_by_actor_id, created_by_user_id,
             metadata, created_at, updated_at
      FROM event_tickets
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, ticketId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toEventTicket(rows[0]);
  }

  async listTicketsByEvent(tenantId: string, eventId: string): Promise<EventTicket[]> {
    const rows = await runQueriesWithTenant<EventTicketRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_id, ticket_type, price_cents, currency,
             quantity_total, quantity_available, created_by_actor_id, created_by_user_id,
             metadata, created_at, updated_at
      FROM event_tickets
      WHERE tenant_id = $1 AND event_id = $2
      ORDER BY ticket_type ASC
      `,
      [tenantId, eventId]
    );

    return rows.map((row) => this.toEventTicket(row));
  }

  /**
   * Edita tipo de ingresso (catálogo — Fatia 1). Ajusta quantity_available pelo MESMO delta de
   * quantity_total (preserva a contagem já vendida = quantity_total_antigo - quantity_available_antigo).
   * Guard atômico (WHERE) recusa deixar quantity_available negativo — sem leitura-depois-escrita.
   * Bank-free: só altera o catálogo (price_cents = valor anunciado, nunca cobrança).
   */
  async updateTicket(
    tenantId: string,
    ticketId: string,
    input: UpdateEventTicketInput
  ): Promise<EventTicket> {
    const row = await runQueryWithTenant<EventTicketRow>(
      tenantId,
      `
      UPDATE event_tickets
      SET price_cents = COALESCE($3, price_cents),
          currency = COALESCE($4, currency),
          quantity_available = quantity_available + (COALESCE($5, quantity_total) - quantity_total),
          quantity_total = COALESCE($5, quantity_total),
          metadata = COALESCE($6::jsonb, metadata),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
        AND (quantity_available + (COALESCE($5, quantity_total) - quantity_total)) >= 0
      RETURNING id, tenant_id, event_id, ticket_type, price_cents, currency,
                quantity_total, quantity_available, created_by_actor_id, created_by_user_id,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        ticketId,
        input.priceCents ?? null,
        input.currency ?? null,
        input.quantityTotal ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );

    if (!row) {
      throw new Error('Tipo de ingresso não encontrado ou quantidade resultante inválida (já vendido excede o novo total)');
    }

    return this.toEventTicket(row);
  }

  /**
   * Decrementa quantity_available (venda confirmada). Nome preservado (chamado por
   * ticket.service.ts na Fatia 2, fora de escopo) — semântica: "mais um vendido" agora lida
   * corretamente contra a coluna real quantity_available (antes lia/escrevia quantity_sold,
   * que não existe).
   */
  async incrementQuantitySold(tenantId: string, ticketId: string): Promise<EventTicket> {
    const row = await runQueryWithTenant<EventTicketRow>(
      tenantId,
      `
      UPDATE event_tickets
      SET quantity_available = quantity_available - 1,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND quantity_available > 0
      RETURNING id, tenant_id, event_id, ticket_type, price_cents, currency,
                quantity_total, quantity_available, created_by_actor_id, created_by_user_id,
                metadata, created_at, updated_at
      `,
      [tenantId, ticketId]
    );

    if (!row) {
      throw new Error('Ingresso não encontrado ou esgotado');
    }

    return this.toEventTicket(row);
  }
}

export const eventTicketRepository = new EventTicketRepository();
