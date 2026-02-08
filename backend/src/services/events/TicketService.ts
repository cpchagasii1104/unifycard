// src/services/events/TicketService.ts
import { v4 as uuid } from 'uuid';
import { runTenantTransaction, runQueryWithTenant } from '@core/db';
import type { CheckoutRequest } from '@unificard/contracts';
import { EventContextBuilder } from '../../types/unifycard-event.types';

interface EventRow {
  id: string;
  tenant_id: string;
  event_type: string;
  city_id: string | null;
  ticket_price: number | null;
  max_capacity: number | null;
  current_occupancy: number;
  status: string;
  starts_at: Date;
  ends_at: Date | null;
  schedule_id: string | null;
}

interface TicketRow {
  id: string;
  tenant_id: string;
  event_id: string;
  global_user_id: string;
  schedule_slot_id: string | null;
  price_paid: number;
  transaction_id: string | null;
  status: string;
  qr_code: string;
  checked_in_at: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface SlotRow {
  slot_id: string;
  schedule_id: string;
  status: string;
}

export class TicketService {
  /**
   * Compra ingresso (transação atômica)
   * 🔴 CRÍTICO: UPDATE atômico de capacidade
   */
  async purchaseTicket(params: {
    eventId: string;
    buyerUserId: string;
    tenantId: string;
    idempotencyKey?: string;
  }): Promise<{ ticketId: string; qrCode: string; price: number | null; transactionId?: string }> {
    const { eventId, buyerUserId, tenantId } = params;

    return runTenantTransaction(tenantId, async (trx) => {
      // 1. Lock evento para leitura/escrita
      const eventResult = await trx.query({
        text: `
          SELECT 
            id, tenant_id, event_type, city_id, ticket_price,
            max_capacity, current_occupancy, status, starts_at, ends_at, schedule_id
          FROM events
          WHERE id = $1
          FOR UPDATE
        `,
        values: [eventId],
      });

      if (eventResult.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventResult[0] as EventRow;

      // 2. Valida status
      if (!['PUBLISHED', 'ONGOING'].includes(event.status)) {
        throw new Error('Event not available for ticket purchase');
      }

      // 3. 🔴 CRÍTICO: UPDATE atômico de capacidade
      // Evita race condition (2 usuários comprando último ingresso)
      // 
      // NOTA: current_occupancy é CACHE, não fonte da verdade.
      // Fonte real = COUNT(event_tickets WHERE status IN ('ACTIVE','USED'))
      // current_occupancy é mantido para performance (evita COUNT em cada query)
      if (event.max_capacity !== null) {
        const updateResult = await trx.query({
          text: `
            UPDATE events
            SET current_occupancy = current_occupancy + 1
            WHERE id = $1
              AND current_occupancy < max_capacity
            RETURNING *
          `,
          values: [eventId],
        });

        if (updateResult.length === 0) {
          throw new Error('Event sold out');
        }
      }

      // 4. 🔴 CRÍTICO: Reserva slot com LOCK (previne overbooking de slot)
      // NOTA: Slot é OPCIONAL. Para eventos grandes (SHOW), pode ser apenas capacidade.
      // Se schedule_id existir, tenta reservar slot. Se não, apenas capacidade.
      let slotId = null;
      if (event.schedule_id) {
        // FOR UPDATE SKIP LOCKED previne que dois usuários peguem o mesmo slot
        const slotResult = await trx.query({
          text: `
            SELECT slot_id, schedule_id, status
            FROM schedule_slots
            WHERE schedule_id = $1
              AND status = 'available'
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `,
          values: [event.schedule_id],
        });

        if (slotResult.length > 0) {
          const slot = slotResult[0] as SlotRow;

          const updateSlotResult = await trx.query({
            text: `
              UPDATE schedule_slots
              SET 
                status = 'reserved',
                reserved_by_global_user_id = $1
              WHERE slot_id = $2
                AND status = 'available'
              RETURNING slot_id
            `,
            values: [buyerUserId, slot.slot_id],
          });

          if (updateSlotResult.length > 0) {
            slotId = slot.slot_id;
          }
        }
        // Se não encontrou slot disponível mas evento permite apenas capacidade, continua
        // (não falha a compra se slot não for obrigatório)
      }

      // 5. 🔴 IDEMPOTÊNCIA: Verificar se ticket já existe (retry)
      if (params.idempotencyKey) {
        const existingTicket = await trx.query({
          text: `
            SELECT id, status, transaction_id
            FROM event_tickets
            WHERE tenant_id = $1 AND idempotency_key = $2
            LIMIT 1
          `,
          values: [tenantId, params.idempotencyKey],
        });

        if (existingTicket.length > 0) {
          const existing = existingTicket[0] as TicketRow;
          // Retornar ticket existente (idempotência)
          return {
            ticketId: existing.id,
            qrCode: existing.qr_code,
            price: event.ticket_price,
            transactionId: existing.transaction_id || undefined,
          };
        }
      }

      // 6. Cria ticket com status PENDING (antes do pagamento)
      const qrCode = uuid();

      const ticketResult = await trx.query({
        text: `
          INSERT INTO event_tickets (
            tenant_id, event_id, global_user_id, schedule_slot_id,
            price_paid, qr_code, status, idempotency_key
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        values: [
          tenantId,
          eventId,
          buyerUserId,
          slotId,
          event.ticket_price || 0,
          qrCode,
          'PENDING', // Status inicial (antes do pagamento)
          params.idempotencyKey || null,
        ],
      });

      if (ticketResult.length === 0) {
        throw new Error('Failed to create ticket');
      }

      const ticket = ticketResult[0] as TicketRow;

      // 7. 🔴 CRÍTICO: Processa checkout (UnifyCard → UnifyBank)
      if (!event.city_id) {
        throw new Error('Event city_id is required for payment processing');
      }

      // Importação dinâmica para evitar dependência circular
      const { checkoutService } = await import('../../core/checkout/CheckoutService');

      const checkoutRequest: CheckoutRequest = {
        amountCents: event.ticket_price || 0,
        currency: 'BRL',
        paymentMethod: 'UNIFYCARD',
        context: {
          module: 'EVENT_TICKET',
          eventId: eventId,
          eventType: event.event_type,
          cityId: event.city_id,
          globalUserId: buyerUserId,
          ticketId: ticket.id,
          scheduleSlotId: slotId,
        },
        idempotencyKey: params.idempotencyKey, // 🔴 CRÍTICO: Para idempotência no ledger
      };

      const checkoutResult = await checkoutService.processCheckout(tenantId, checkoutRequest);

      if (!checkoutResult.success || !checkoutResult.transactionId) {
        throw new Error('Checkout failed: ' + (checkoutResult.error || 'Unknown error'));
      }

      // 8. Atualiza ticket para ACTIVE e vincula transaction_id
      await trx.query({
        text: `
          UPDATE event_tickets
          SET 
            status = 'ACTIVE',
            transaction_id = $1
          WHERE id = $2
        `,
        values: [checkoutResult.transactionId, ticket.id],
      });

      return {
        ticketId: ticket.id,
        qrCode,
        price: event.ticket_price,
        transactionId: checkoutResult.transactionId,
      };
    });
  }

  /**
   * Check-in (valida QR code)
   */
  async checkIn(qrCode: string, tenantId: string): Promise<{
    success: boolean;
    event: {
      id: string;
      title: string;
      starts_at: Date;
    };
  }> {
    return runTenantTransaction(tenantId, async (trx) => {
      const ticketResult = await trx.query({
        text: `
          SELECT *
          FROM event_tickets
          WHERE qr_code = $1
          FOR UPDATE
        `,
        values: [qrCode],
      });

      if (ticketResult.length === 0) {
        throw new Error('Invalid QR code');
      }

      const ticket = ticketResult[0] as TicketRow;

      if (ticket.status !== 'ACTIVE') {
        throw new Error(`Ticket already ${ticket.status.toLowerCase()}`);
      }

      const eventResult = await trx.query({
        text: `
          SELECT id, title, starts_at, ends_at
          FROM events
          WHERE id = $1
        `,
        values: [ticket.event_id],
      });

      if (eventResult.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventResult[0] as {
        id: string;
        title: string;
        starts_at: Date;
        ends_at: Date | null;
      };

      const now = new Date();
      if (now < event.starts_at) {
        throw new Error('Event has not started yet');
      }

      if (event.ends_at && now > event.ends_at) {
        throw new Error('Event has ended');
      }

      await trx.query({
        text: `
          UPDATE event_tickets
          SET 
            status = 'USED',
            checked_in_at = $1
          WHERE id = $2
        `,
        values: [now, ticket.id],
      });

      return {
        success: true,
        event: {
          id: event.id,
          title: event.title,
          starts_at: event.starts_at,
        },
      };
    });
  }
}






























