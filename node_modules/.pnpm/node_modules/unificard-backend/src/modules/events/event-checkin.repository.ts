// backend/src/modules/events/event-checkin.repository.ts
// SPRINT 76: Repository para event_checkins

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { EventCheckIn } from './event.types';

interface EventCheckInRow {
  id: string;
  tenant_id: string;
  ticket_sale_id: string;
  checked_inAt: Date;
  checked_in_by_actor_id: string;
  checked_in_by_user_id: string | null;
  checked_outAt: Date | null;
  checked_out_by_actor_id: string | null;
  checked_out_by_user_id: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class EventCheckInRepository {
  private toEventCheckIn(row: EventCheckInRow): EventCheckIn {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ticketSaleId: row.ticket_sale_id,
      checkedInAt: row.checked_inAt,
      checkedInByActorId: row.checked_in_by_actor_id,
      checkedInByUserId: row.checked_in_by_user_id,
      checkedOutAt: row.checked_outAt,
      checkedOutByActorId: row.checked_out_by_actor_id,
      checkedOutByUserId: row.checked_out_by_user_id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createCheckIn(
    tenantId: string,
    input: {
      ticketSaleId: string;
      checkedInByActorId: string;
      checkedInByUserId: string | null;
    }
  ): Promise<EventCheckIn> {
    const row = await runQueryWithTenant<EventCheckInRow>(
      tenantId,
      `
      INSERT INTO event_checkins (
        tenant_id, ticket_sale_id, checked_in_by_actor_id, checked_in_by_user_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, ticket_sale_id, checked_inAt, checked_in_by_actor_id, checked_in_by_user_id,
                checked_outAt, checked_out_by_actor_id, checked_out_by_user_id,
                createdAt, updatedAt
      `,
      [
        tenantId,
        input.ticketSaleId,
        input.checkedInByActorId,
        input.checkedInByUserId,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar check-in');
    }

    return this.toEventCheckIn(row);
  }

  async getCheckInByTicketSale(tenantId: string, ticketSaleId: string): Promise<EventCheckIn | null> {
    const rows = await runQueriesWithTenant<EventCheckInRow>(
      tenantId,
      `
      SELECT id, tenant_id, ticket_sale_id, checked_inAt, checked_in_by_actor_id, checked_in_by_user_id,
             checked_outAt, checked_out_by_actor_id, checked_out_by_user_id,
             createdAt, updatedAt
      FROM event_checkins
      WHERE tenant_id = $1 AND ticket_sale_id = $2
      LIMIT 1
      `,
      [tenantId, ticketSaleId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toEventCheckIn(rows[0]);
  }

  async checkOut(
    tenantId: string,
    checkInId: string,
    checkedOutByActorId: string,
    checkedOutByUserId: string | null
  ): Promise<EventCheckIn> {
    const row = await runQueryWithTenant<EventCheckInRow>(
      tenantId,
      `
      UPDATE event_checkins
      SET checked_outAt = NOW(),
          checked_out_by_actor_id = $3,
          checked_out_by_user_id = $4,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND checked_outAt IS NULL
      RETURNING id, tenant_id, ticket_sale_id, checked_inAt, checked_in_by_actor_id, checked_in_by_user_id,
                checked_outAt, checked_out_by_actor_id, checked_out_by_user_id,
                createdAt, updatedAt
      `,
      [tenantId, checkInId, checkedOutByActorId, checkedOutByUserId]
    );

    if (!row) {
      throw new Error('Check-in não encontrado ou já fez check-out');
    }

    return this.toEventCheckIn(row);
  }
}

export const eventCheckInRepository = new EventCheckInRepository();








