// backend/src/modules/events/event-ticket.repository.ts
// SPRINT 76: Repository para event_tickets

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
  quantity_sold: number;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
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
      quantitySold: row.quantity_sold,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

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
        quantity_total, created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING id, tenant_id, event_id, ticket_type, price_cents, currency,
                quantity_total, quantity_sold, created_by_actor_id, created_by_user_id,
                metadata, createdAt, updatedAt
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
             quantity_total, quantity_sold, created_by_actor_id, created_by_user_id,
             metadata, createdAt, updatedAt
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
             quantity_total, quantity_sold, created_by_actor_id, created_by_user_id,
             metadata, createdAt, updatedAt
      FROM event_tickets
      WHERE tenant_id = $1 AND event_id = $2
      ORDER BY ticket_type ASC
      `,
      [tenantId, eventId]
    );

    return rows.map((row) => this.toEventTicket(row));
  }

  async incrementQuantitySold(tenantId: string, ticketId: string): Promise<EventTicket> {
    const row = await runQueryWithTenant<EventTicketRow>(
      tenantId,
      `
      UPDATE event_tickets
      SET quantity_sold = quantity_sold + 1,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND quantity_sold < quantity_total
      RETURNING id, tenant_id, event_id, ticket_type, price_cents, currency,
                quantity_total, quantity_sold, created_by_actor_id, created_by_user_id,
                metadata, createdAt, updatedAt
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








