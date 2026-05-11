// backend/src/modules/events/ticket-sale.repository.ts
// SPRINT 76: Repository para ticket_sales

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { TicketSale } from './event.types';

interface TicketSaleRow {
  id: string;
  tenant_id: string;
  event_ticket_id: string;
  buyer_actor_id: string;
  payment_intent_id: string | null;
  status: string;
  reserved_at: Date;
  paid_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by_actor_id: string | null;
  cancellation_reason: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class TicketSaleRepository {
  private toTicketSale(row: TicketSaleRow): TicketSale {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventTicketId: row.event_ticket_id,
      buyerActorId: row.buyer_actor_id,
      paymentIntentId: row.payment_intent_id,
      status: row.status as any,
      reservedAt: row.reserved_at,
      paidAt: row.paid_at,
      cancelledAt: row.cancelled_at,
      cancelledByActorId: row.cancelled_by_actor_id,
      cancellationReason: row.cancellation_reason,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async createSale(
    tenantId: string,
    input: {
      eventTicketId: string;
      buyerActorId: string;
      paymentIntentId: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<TicketSale> {
    const row = await runQueryWithTenant<TicketSaleRow>(
      tenantId,
      `
      INSERT INTO ticket_sales (
        tenant_id, event_ticket_id, buyer_actor_id, payment_intent_id,
        status, created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING id, tenant_id, event_ticket_id, buyer_actor_id, payment_intent_id,
                status, reserved_at, paid_at, cancelled_at, cancelled_by_actor_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [
        tenantId,
        input.eventTicketId,
        input.buyerActorId,
        input.paymentIntentId,
        'pending', // C64 fix: alinhado com schema CHECK
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar venda de ingresso');
    }

    return this.toTicketSale(row);
  }

  async getSaleById(tenantId: string, saleId: string): Promise<TicketSale | null> {
    const rows = await runQueriesWithTenant<TicketSaleRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_ticket_id, buyer_actor_id, payment_intent_id,
             status, reserved_at, paid_at, cancelled_at, cancelled_by_actor_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             created_at, updated_at
      FROM ticket_sales
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, saleId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toTicketSale(rows[0]);
  }

  async confirmPayment(tenantId: string, saleId: string): Promise<TicketSale> {
    const row = await runQueryWithTenant<TicketSaleRow>(
      tenantId,
      `
      UPDATE ticket_sales
      SET status = 'completed',
          paid_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING id, tenant_id, event_ticket_id, buyer_actor_id, payment_intent_id,
                status, reserved_at, paid_at, cancelled_at, cancelled_by_actor_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [tenantId, saleId]
    );

    if (!row) {
      throw new Error('Venda não encontrada ou não está em pending');
    }

    return this.toTicketSale(row);
  }

  async cancelSale(
    tenantId: string,
    saleId: string,
    cancelledByActorId: string,
    cancellationReason: string | null
  ): Promise<TicketSale> {
    const row = await runQueryWithTenant<TicketSaleRow>(
      tenantId,
      `
      UPDATE ticket_sales
      SET status = 'refunded',
          cancelled_at = NOW(),
          cancelled_by_actor_id = $3,
          cancellation_reason = $4,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING id, tenant_id, event_ticket_id, buyer_actor_id, payment_intent_id,
                status, reserved_at, paid_at, cancelled_at, cancelled_by_actor_id, cancellation_reason,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [tenantId, saleId, cancelledByActorId, cancellationReason]
    );

    if (!row) {
      throw new Error('Venda não encontrada ou não pode ser cancelada');
    }

    return this.toTicketSale(row);
  }

  async listSalesByTicket(tenantId: string, eventTicketId: string): Promise<TicketSale[]> {
    const rows = await runQueriesWithTenant<TicketSaleRow>(
      tenantId,
      `
      SELECT id, tenant_id, event_ticket_id, buyer_actor_id, payment_intent_id,
             status, reserved_at, paid_at, cancelled_at, cancelled_by_actor_id, cancellation_reason,
             created_by_actor_id, created_by_user_id, metadata,
             created_at, updated_at
      FROM ticket_sales
      WHERE tenant_id = $1 AND event_ticket_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, eventTicketId]
    );

    return rows.map((row) => this.toTicketSale(row));
  }
}

export const ticketSaleRepository = new TicketSaleRepository();
