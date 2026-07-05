// Checkout legado (HTTP /core/checkout) — não confundir com ticket.service.ts (Sprint 76).
import { v4 as uuid } from 'uuid';
import { runTenantTransaction, runQueryWithTenant } from '@core/db';
import type { CheckoutRequest } from '@unificard/contracts';
import { EventContextBuilder } from '../../types/unifycard-event.types';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';

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
  unified_availability_id: string | null;
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

export class CheckoutTicketService {
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
    // F-CHECKOUT-EVENT-TICKET-LEGACY-INSERT-SCHEMA-GHOST-CONTAINMENT (achado da Onda 1 zeragem de
    // DT, 2026-07-05, DT-TEMPORAL-LEGACY-DECOMMISSION-RESIDUES R2): o INSERT abaixo em
    // `event_tickets` usa colunas (`global_user_id`/`schedule_slot_id`/`price_paid`/`qr_code`/
    // `status`/`idempotency_key`) que NUNCA existiram na tabela — a única migration que a cria
    // (`20260530120000_event_tickets.sql`) tem shape de "tipo de ingresso" (ticket_type/
    // price_cents/quantity_total), não de ingresso emitido. Se executado, falharia com erro de
    // SQL (coluna inexistente). O frontend JÁ foi rerroteado pro caminho canônico
    // (`POST /api/events/:id/checkout`, `event.routes.ts`); esta rota (`POST /checkout/event-ticket`)
    // segue MONTADA sem guard. Contenção fail-closed NA BORDA do service (não é gênese de schema
    // nem correção do fluxo de compra — decisão de desmontar a rota vs. redesenhar o INSERT fica
    // pra frente própria). Throw honesto ANTES de tocar qualquer tabela.
    throw new Error(
      'CHECKOUT_EVENT_TICKET_LEGACY_SCHEMA_GHOST_CONTAINED: compra de ingresso pelo caminho legado ' +
        '/checkout/event-ticket está desativada — o INSERT usa um schema de event_tickets que nunca ' +
        'existiu no banco. Use o caminho canônico POST /api/events/:id/checkout.'
    );

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

      // 2. Valida status (Etapa 1.6 — schema events.status CHECK usa lowercase canônico:
      // 'draft'|'declared'|'published'|'active'|'ended'|'cancelled'. 'PUBLISHED'/'ONGOING'
      // uppercase eram vestígios pré-rename que tornavam o caminho /api/checkout/event-ticket
      // inalcançável — exposto pela tentativa de validação visual da Fase 1.)
      if (!['published', 'active'].includes(event.status)) {
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

      // 4. Reserva temporal canônica via unified_availability (C63 FASE 2B — DECISION-0015)
      // schedule_slots era SSOT temporal inválido — migrado para unified_availability.
      // slotId mantido como null (campo legado schedule_slot_id permanece null).
      const slotId = null;
      let unifiedBookingId: string | null = null;

      if (event.unified_availability_id) {
        // Caminho canônico: evento já vinculado ao SSOT temporal correto
        // 🔴 DECISION-0148 — normaliza global_user_id → users.id (subjectUserId) na MESMA linha do actor.
        // buyerUserId é global_user_id; o subject do core exige o user_id real (casa com actors.user_id).
        const actorResult = await trx.query({
          text: `SELECT actor_id, user_id FROM actors WHERE global_user_id = $1 AND tenant_id = $2 LIMIT 1`,
          values: [buyerUserId, tenantId],
        });
        const requesterActorId: string | null = actorResult[0]?.actor_id ?? null;
        const subjectUserId: string | null = actorResult[0]?.user_id ?? null;

        if (requesterActorId && subjectUserId) {
          const booking = await unifiedAvailabilityService.createBooking(
            tenantId,
            { subjectUserId, requesterActorId }, // self-booking: comprador representa o próprio actor
            { availabilityId: event.unified_availability_id, requesterActorId },
            trx
          );
          unifiedBookingId = booking.bookingId;
        }
      }
      // Se unified_availability_id ainda não está populado, continua sem reserva de slot
      // (comportamento válido — campo é opcional até migração de dados completa)

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
            unified_booking_id, price_paid, qr_code, status, idempotency_key
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        values: [
          tenantId,
          eventId,
          buyerUserId,
          slotId,
          unifiedBookingId,
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
        amount: event.ticket_price || 0,
        currency: 'BRL',
        paymentMethod: 'UNIFYCARD',
        context: {
          module: 'EVENT_TICKET',
          eventId: eventId,
          eventType: event.event_type,
          cityId: event.city_id,
          globalUserId: buyerUserId,
          ticketId: ticket.id,
          scheduleSlotId: slotId ?? undefined,
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
    // F-CHECKOUT-EVENT-TICKET-LEGACY-INSERT-SCHEMA-GHOST-CONTAINMENT (achado da re-auditoria Yala,
    // 2026-07-05, R-baixa 1 sobre a contenção de purchaseTicket): checkIn é MÉTODO IRMÃO do mesmo
    // service, mesma classe de bug — lê `qr_code`/`status` de `event_tickets`, colunas que NUNCA
    // existiram na tabela real (única migration que a cria, `20260530120000_event_tickets.sql`, tem
    // shape de "tipo de ingresso": ticket_type/price_cents/quantity_total). Se executado, falharia
    // com erro de SQL (coluna inexistente). Rota `POST /api/events/checkin` está MONTADA
    // (`event-lifecycle.routes.ts`) e alcança este método diretamente. Throw honesto ANTES de
    // qualquer SQL — mesmo padrão de `purchaseTicket` acima.
    throw new Error(
      'CHECKOUT_EVENT_TICKET_LEGACY_SCHEMA_GHOST_CONTAINED: check-in de ingresso pelo caminho legado ' +
        'está desativado — a leitura usa um schema de event_tickets que nunca existiu no banco.'
    );

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