// backend/src/modules/support-tickets/support-ticket.repository.ts
// F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6) — persistência do Chamado + resolução do FATO DE
// NEGÓCIO real a partir das fontes de verdade VIVAS (orders/service_orders/availability+bookings).
// COMPOSIÇÃO PURA (Lei de Coerência §5): este repository NUNCA duplica dado de negócio — só LÊ
// as tabelas doras do pilar pra resolver as duas partes reais, na hora, sem cache.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  BusinessFactParties,
  EligibleBusinessFactReference,
  SupportTicket,
  SupportTicketFilters,
  SupportTicketReferenceType,
  SupportTicketStatus,
} from './support-ticket.types';

interface SupportTicketRow {
  id: string;
  tenant_id: string;
  reference_type: string;
  reference_id: string;
  from_actor_id: string;
  to_actor_id: string;
  subject: string;
  message: string;
  status: string;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLS = `id, tenant_id, reference_type, reference_id, from_actor_id, to_actor_id,
       subject, message, status, resolved_at, created_at, updated_at`;

class SupportTicketRepository {
  private toTicket(row: SupportTicketRow): SupportTicket {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      referenceType: row.reference_type as SupportTicketReferenceType,
      referenceId: row.reference_id,
      fromActorId: row.from_actor_id,
      toActorId: row.to_actor_id,
      subject: row.subject,
      message: row.message,
      status: row.status as SupportTicketStatus,
      resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  // ── Resolução do FATO DE NEGÓCIO (lê a fonte viva, nunca duplica) ────────────────────────

  /** `orders` — compra de produto. Retorna {partyA:buyer, partyB:seller} ou null se não existe. */
  async resolveOrderParties(tenantId: string, orderId: string): Promise<BusinessFactParties | null> {
    const row = await runQueryWithTenant<{ buyer_actor_id: string; seller_actor_id: string }>(
      tenantId,
      `SELECT buyer_actor_id, seller_actor_id FROM orders WHERE tenant_id = $1 AND id = $2`,
      [tenantId, orderId]
    );
    return row ? { partyA: row.buyer_actor_id, partyB: row.seller_actor_id } : null;
  }

  /** `service_orders` — contratação de serviço. {partyA:customer, partyB:worker}. */
  async resolveServiceOrderParties(tenantId: string, serviceOrderId: string): Promise<BusinessFactParties | null> {
    const row = await runQueryWithTenant<{ customer_actor_id: string; worker_actor_id: string }>(
      tenantId,
      `SELECT customer_actor_id, worker_actor_id FROM service_orders WHERE tenant_id = $1 AND id = $2`,
      [tenantId, serviceOrderId]
    );
    return row ? { partyA: row.customer_actor_id, partyB: row.worker_actor_id } : null;
  }

  /**
   * `bookings` + `availability` — reserva/agendamento. {partyA:requester, partyB:owner-real}.
   * O owner da agenda é POLIMÓRFICO (`availability.owner_type`) — resolve o actor real por tipo:
   *   user/page            → owner_id JÁ é o actor_id;
   *   service_offering     → service_offerings.provider_actor_id;
   *   service              → services.actor_id;
   *   rentable_resource    → rentable_resources.owner_actor_id.
   * `event`/`group` NÃO suportados nesta fatia (menos comum p/ "negócio 1:1"; nomeado, não
   * adivinhado) — retorna null (o service converte em 422 fail-closed, nunca silencioso).
   */
  async resolveBookingParties(tenantId: string, bookingId: string): Promise<BusinessFactParties | null> {
    const booking = await runQueryWithTenant<{ requester_actor_id: string; availability_id: string }>(
      tenantId,
      `SELECT requester_actor_id, availability_id FROM bookings WHERE tenant_id = $1 AND booking_id = $2`,
      [tenantId, bookingId]
    );
    if (!booking) return null;

    const avail = await runQueryWithTenant<{ owner_type: string; owner_id: string }>(
      tenantId,
      `SELECT owner_type, owner_id FROM availability WHERE tenant_id = $1 AND availability_id = $2`,
      [tenantId, booking.availability_id]
    );
    if (!avail) return null;

    let ownerActorId: string | null = null;
    switch (avail.owner_type) {
      case 'user':
      case 'page':
        ownerActorId = avail.owner_id;
        break;
      case 'service_offering': {
        const so = await runQueryWithTenant<{ provider_actor_id: string }>(
          tenantId,
          `SELECT provider_actor_id FROM service_offerings WHERE tenant_id = $1 AND id = $2`,
          [tenantId, avail.owner_id]
        );
        ownerActorId = so?.provider_actor_id ?? null;
        break;
      }
      case 'service': {
        const s = await runQueryWithTenant<{ actor_id: string }>(
          tenantId,
          `SELECT actor_id FROM services WHERE tenant_id = $1 AND service_id = $2`,
          [tenantId, avail.owner_id]
        );
        ownerActorId = s?.actor_id ?? null;
        break;
      }
      case 'rentable_resource': {
        const rr = await runQueryWithTenant<{ owner_actor_id: string }>(
          tenantId,
          `SELECT owner_actor_id FROM rentable_resources WHERE tenant_id = $1 AND id = $2`,
          [tenantId, avail.owner_id]
        );
        ownerActorId = rr?.owner_actor_id ?? null;
        break;
      }
      default:
        return null; // event/group: fora de escopo desta fatia, fail-closed (nunca adivinha)
    }
    if (!ownerActorId) return null;
    return { partyA: booking.requester_actor_id, partyB: ownerActorId };
  }

  async resolveParties(tenantId: string, referenceType: SupportTicketReferenceType, referenceId: string): Promise<BusinessFactParties | null> {
    switch (referenceType) {
      case 'order': return this.resolveOrderParties(tenantId, referenceId);
      case 'service_order': return this.resolveServiceOrderParties(tenantId, referenceId);
      case 'booking': return this.resolveBookingParties(tenantId, referenceId);
    }
  }

  /**
   * Lista os fatos de negócio REAIS entre `actorId` e `counterpartActorId` — usado (a) pela UI
   * pra deixar o autor ESCOLHER qual referência específica citar, e (b) pelo contrato da página
   * do actor pra decidir se a ação "Abrir chamado" acende (existe ≥1 fato real, qualquer um).
   */
  async listEligibleReferences(
    tenantId: string,
    actorId: string,
    counterpartActorId: string
  ): Promise<EligibleBusinessFactReference[]> {
    const orders = await runQueriesWithTenant<{ id: string; status: string; created_at: Date }>(
      tenantId,
      `SELECT id, status, created_at FROM orders WHERE tenant_id = $1
         AND ((buyer_actor_id = $2 AND seller_actor_id = $3) OR (buyer_actor_id = $3 AND seller_actor_id = $2))
       ORDER BY created_at DESC LIMIT 20`,
      [tenantId, actorId, counterpartActorId]
    );
    const serviceOrders = await runQueriesWithTenant<{ id: string; status: string; created_at: Date }>(
      tenantId,
      `SELECT id, status, created_at FROM service_orders WHERE tenant_id = $1
         AND ((customer_actor_id = $2 AND worker_actor_id = $3) OR (customer_actor_id = $3 AND worker_actor_id = $2))
       ORDER BY created_at DESC LIMIT 20`,
      [tenantId, actorId, counterpartActorId]
    );
    // bookings: resolve owner por tipo é caro pra fazer em massa via SQL genérico — varre as
    // reservas do par (requester ∈ {actorId, counterpartActorId}) e resolve individualmente
    // (teto pequeno, nunca tenant-wide).
    const bookingCandidates = await runQueriesWithTenant<{ booking_id: string; status: string; created_at: Date }>(
      tenantId,
      `SELECT booking_id, status, created_at FROM bookings WHERE tenant_id = $1
         AND requester_actor_id IN ($2, $3)
       ORDER BY created_at DESC LIMIT 20`,
      [tenantId, actorId, counterpartActorId]
    );
    const bookingsResolved: EligibleBusinessFactReference[] = [];
    for (const b of bookingCandidates) {
      const parties = await this.resolveBookingParties(tenantId, b.booking_id);
      if (!parties) continue;
      const pair = [parties.partyA, parties.partyB].sort();
      const target = [actorId, counterpartActorId].sort();
      if (pair[0] === target[0] && pair[1] === target[1]) {
        const counterpart = parties.partyA === actorId ? parties.partyB : parties.partyA;
        bookingsResolved.push({ referenceType: 'booking', referenceId: b.booking_id, counterpartActorId: counterpart, label: `Reserva (${b.status})` });
      }
    }

    return [
      ...orders.map((o) => ({ referenceType: 'order' as const, referenceId: o.id, counterpartActorId, label: `Pedido (${o.status})` })),
      ...serviceOrders.map((s) => ({ referenceType: 'service_order' as const, referenceId: s.id, counterpartActorId, label: `Serviço contratado (${s.status})` })),
      ...bookingsResolved,
    ];
  }

  /** Existência RÁPIDA (para o contrato da página do actor) — algum fato real com esse actor? */
  async hasAnyBusinessFact(tenantId: string, actorId: string, counterpartActorId: string): Promise<boolean> {
    const refs = await this.listEligibleReferences(tenantId, actorId, counterpartActorId);
    return refs.length > 0;
  }

  // ── CRUD do chamado ───────────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    input: {
      referenceType: SupportTicketReferenceType;
      referenceId: string;
      fromActorId: string;
      toActorId: string;
      subject: string;
      message: string;
      createdByUserId: string;
    }
  ): Promise<SupportTicket> {
    const row = await runQueryWithTenant<SupportTicketRow>(
      tenantId,
      `INSERT INTO support_tickets
         (tenant_id, reference_type, reference_id, from_actor_id, to_actor_id, subject, message, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_COLS}`,
      [tenantId, input.referenceType, input.referenceId, input.fromActorId, input.toActorId, input.subject, input.message, input.createdByUserId]
    );
    if (!row) throw new Error('Falha ao criar chamado');
    return this.toTicket(row);
  }

  async findById(tenantId: string, id: string): Promise<SupportTicket | null> {
    const row = await runQueryWithTenant<SupportTicketRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM support_tickets WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return row ? this.toTicket(row) : null;
  }

  async respond(tenantId: string, id: string, status: SupportTicketStatus, respondedByUserId: string): Promise<SupportTicket | null> {
    const row = await runQueryWithTenant<SupportTicketRow>(
      tenantId,
      `UPDATE support_tickets
          SET status = $3, responded_by_user_id = $4, resolved_at = CASE WHEN $3 IN ('resolved','closed') THEN now() ELSE resolved_at END
        WHERE tenant_id = $1 AND id = $2
       RETURNING ${SELECT_COLS}`,
      [tenantId, id, status, respondedByUserId]
    );
    return row ? this.toTicket(row) : null;
  }

  async listForActor(tenantId: string, actorId: string, filters: SupportTicketFilters = {}): Promise<SupportTicket[]> {
    const params: unknown[] = [tenantId, actorId];
    let where = `tenant_id = $1 AND (from_actor_id = $2 OR to_actor_id = $2)`;
    if (filters.status) {
      params.push(filters.status);
      where += ` AND status = $${params.length}`;
    }
    params.push(Math.min(filters.limit ?? 50, 200));
    const limitIdx = params.length;
    params.push(filters.offset ?? 0);
    const offsetIdx = params.length;

    const rows = await runQueriesWithTenant<SupportTicketRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM support_tickets
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params as any[]
    );
    return rows.map((r) => this.toTicket(r));
  }
}

export const supportTicketRepository = new SupportTicketRepository();
