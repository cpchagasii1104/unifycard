// backend/src/modules/events/events-sprint76.routes.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

import type { FastifyInstance } from 'fastify';
import { eventRepository } from './event.repository';
import { ticketService } from './ticket.service';
import { checkInService } from './checkin.service';
import { eventTicketRepository } from './event-ticket.repository';
import type {
  CreateEventInput,
  CreateEventTicketInput,
  ReserveTicketInput,
} from './event.types';
import type { UpdateEventTicketInput } from './event-ticket.repository';

/**
 * 🔒 F-EVENT-TICKETING-CONVERGENCE (Fatia 1) — autoridade de CATÁLOGO de ingresso: o actor DONO
 * do evento (event.organizerActorId, server-resolved) precisa da CHAVE EXATA (create_events para
 * criar tipo novo; manage_events para editar tipo existente) — nunca representação isolada
 * (DECISION-0189A §3) nem o hint client-declarado (DECISION-0113). Espelha `userCanActOnActor` de
 * core/events/event.routes.ts (mesmo predicado; duplicado localmente porque aquele helper é
 * privado ao módulo core/events e este arquivo vive em modules/events).
 */
async function userCanActOnEventOwner(
  tenantId: string,
  userId: string | undefined,
  eventOwnerActorId: string | undefined,
  permissionKey: 'create_events' | 'manage_events'
): Promise<boolean> {
  if (!userId || !eventOwnerActorId) return false;
  const { authorizationService } = await import('@core/authorization/authorization.service');
  try {
    if ((await authorizationService.canActAs(tenantId, userId, eventOwnerActorId, permissionKey)).allowed) {
      return true;
    }
    // Evento de GRUPO: sem chave de governança de grupo (fora do escopo desta campanha) — mantém
    // o comportamento anterior (dono representa), mesma exceção do precedente em core/events.
    const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actor = await socialPortsRegistry.getActorRepository().findById(tenantId, eventOwnerActorId);
    if (actor && (actor as { group_id?: string | null }).group_id) {
      return await authorizationService.canRepresentActor(tenantId, userId, eventOwnerActorId);
    }
    return false;
  } catch {
    return false;
  }
}

/** Mesma auditoria que o wrapper sprint76 removido (create + audit). */
async function recordSprint76EventAudit(
  tenantId: string,
  data: {
    eventType: string;
    eventId: string;
    createdByActorId?: string;
    createdByUserId?: string | null;
    publishedByActorId?: string;
    publishedByUserId?: string | null;
    cancelledByActorId?: string;
    cancelledByUserId?: string | null;
    cancellationReason?: string | null;
  }
): Promise<void> {
  try {
    const { auditService } = await import('@core/audit/audit.service');
    await auditService.record(tenantId, {
      event_type: data.eventType,
      severity: 'medium',
      actor_id: data.createdByActorId || data.publishedByActorId || data.cancelledByActorId || undefined,
      actor_type: 'user',
      source: 'cultural_event_checkin',
      context: {
        event_id: data.eventId,
        created_by_user_id: data.createdByUserId,
        published_by_actor_id: data.publishedByActorId,
        published_by_user_id: data.publishedByUserId,
        cancelled_by_actor_id: data.cancelledByActorId,
        cancelled_by_user_id: data.cancelledByUserId,
        cancellation_reason: data.cancellationReason,
      },
    });
  } catch (error) {
    console.warn('[Event] Erro ao registrar auditoria:', error);
  }
}

const eventsSprint76Routes = async (fastify: FastifyInstance) => {
  // ============================================================
  // EVENTOS
  // ============================================================

  /**
   * POST /events
   * Cria novo evento
   */
  fastify.post<{ Body: CreateEventInput }>('/events', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    // 🔴 F-CAMADA-1-GATE-ACTIONCTX (DECISION-0113): actionContext.actorId é HINT cliente-declarado, NÃO autoridade.
    // O caller autenticado deve poder representar o actor declarado, senão forja authorship em nome de outro.
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    if (!(await authorizationService.canRepresentActor(tenantId, userId, actionContext.actorId))) {
      return reply.status(403).send({ error: 'ACTOR_REPRESENTATION_DENIED', code: 'ACTOR_REPRESENTATION_DENIED' });
    }

    // Converter datas se necessário
    const body = req.body as any;
    if (body.startAt) {
      body.startAt = new Date(body.startAt);
    }
    if (body.endAt) {
      body.endAt = new Date(body.endAt);
    }

    const event = await eventRepository.createEvent(tenantId, {
      organizerActorId: body.organizerActorId,
      title: body.title,
      description: body.description || null,
      locationActorId: body.locationActorId || null,
      startAt: body.startAt,
      endAt: body.endAt,
      createdByActorId: actionContext.actorId,
      createdByUserId: userId,
      metadata: body.metadata || {},
    });

    await recordSprint76EventAudit(tenantId, {
      eventType: 'EVENT_CREATED',
      eventId: event.id,
      createdByActorId: actionContext.actorId,
      createdByUserId: userId,
    });

    return reply.status(201).send(event);
  });

  /**
   * POST /events/:id/publish
   * Publica evento
   * 
   * 🔴 ROTA REMOVIDA - DUPLICADA
   * Esta rota está duplicada com:
   * - backend/src/core/events/event.routes.ts (linha 391): POST /api/events/:id/publish (v1)
   * - backend/src/core/events/event.routes.ts (linha 1019): POST /api/events/:id/v2/publish (v2)
   * 
   * Use uma das rotas canônicas acima.
   */
  // fastify.post<{ Params: { id: string } }>('/events/:id/publish', async (req, reply) => {
  //   const tenantId = req.tenant!.id;
  //   const actionContext = (req as any).actionContext;

  //   if (!actionContext?.actorId) {
  //     return reply.status(400).send({ error: 'actorId é obrigatório' });
  //   }

  //   const event = await eventService.publishEvent(
  //     tenantId,
  //     req.params.id,
  //     actionContext.actorId,
  //     actionContext.actorId
  //   );

  //   return reply.send(event);
  // });

  /**
   * GET /events
   * Lista eventos
   */
  fastify.get<{
    Querystring: {
      organizerActorId?: string;
      locationActorId?: string;
      status?: string;
      visibility?: string;
      startAtFrom?: string;
      startAtTo?: string;
      limit?: number;
      offset?: number;
    };
  }>('/events', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    // 🔵 DECISION-0113 F6.5.6b — modo de visibilidade do GET /events:
    //  · sem organizerActorId                          → public_discovery (piso B1).
    //  · organizerActorId + caller NÃO representável    → public_discovery DAQUELE organizer (NÃO 403 — vitrine).
    //  · organizerActorId + caller representável         → organizer_dashboard (vê os próprios não-públicos).
    // O cliente estreita; o servidor define o piso. group/followers/unlisted globais e canal-5 = B3/B4/canal-5.
    // userId do caller (derivado de req.user — NUNCA de actorId declarado). Usado p/ decidir representação
    // (organizer dashboard) E p/ abrir 'group' na discovery (B3, membership por group_members.user_id).
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    const filters: any = {
      visibilityMode: 'public_discovery' as 'public_discovery' | 'organizer_dashboard',
      discoveryUserId: userId,
    };
    if (req.query.organizerActorId) {
      filters.organizerActorId = req.query.organizerActorId;
      if (userId) {
        let canRepresent = false;
        try {
          const { authorizationService } = await import('@core/authorization/authorization.service');
          canRepresent = await authorizationService.canRepresentActor(tenantId, userId, req.query.organizerActorId);
        } catch { canRepresent = false; }
        if (canRepresent) {
          filters.visibilityMode = 'organizer_dashboard';
        }
      }
    }
    if (req.query.locationActorId) {
      filters.locationActorId = req.query.locationActorId;
    }
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.visibility) {
      filters.visibility = req.query.visibility;
    }
    if (req.query.startAtFrom) {
      filters.startAtFrom = new Date(req.query.startAtFrom);
    }
    if (req.query.startAtTo) {
      filters.startAtTo = new Date(req.query.startAtTo);
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    const events = await eventRepository.listEvents(tenantId, filters);

    return reply.send({ events, totalCents: events.length });
  });

  /**
   * GET /events/:id
   * Busca evento por ID
   */
  fastify.get<{ Params: { id: string } }>('/events/:id', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const event = await eventRepository.getEventById(tenantId, req.params.id);

    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    // 🔵 DECISION-0113 F6.5.6b-CANAL5-A: acesso por ID herda o modelo de visibility da discovery (B1–B4).
    // Deny-first → 404 não-leak (não confirma existência) para evento que o caller não pode ver.
    const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
    const { canViewEvent } = await import('@core/events/event-visibility.service');
    if (!(await canViewEvent(tenantId, req.params.id, callerUserId))) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }

    return reply.send(event);
  });

  // ============================================================
  // INGRESSOS
  // ============================================================

  /**
   * POST /events/:id/tickets
   * Cria tipo de ingresso para evento
   */
  fastify.post<{
    Params: { id: string };
    Body: CreateEventTicketInput;
  }>('/events/:id/tickets', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    // 🔴 F-EVENT-TICKETING-CONVERGENCE (Fatia 1): autoridade é sobre o DONO DO EVENTO
    // (event.organizerActorId, server-resolved), NÃO sobre actionContext.actorId (HINT, DECISION-0113).
    // create_events = chave exata para criar tipo novo (DECISION-0189A §3).
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const event = await eventRepository.getEventById(tenantId, req.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }
    if (!(await userCanActOnEventOwner(tenantId, userId, event.organizerActorId, 'create_events'))) {
      return reply.status(403).send({ error: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED', code: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED' });
    }

    const ticket = await ticketService.createTicketType(
      tenantId,
      req.params.id,
      req.body,
      event.organizerActorId,
      userId
    );

    return reply.status(201).send(ticket);
  });

  /**
   * PATCH /events/:id/tickets/:ticketId
   * Edita tipo de ingresso (preço/quantidade/moeda/metadata) — catálogo (Fatia 1). Bank-free
   * (price_cents = valor ANUNCIADO, nunca cobrança). manage_events = chave exata para editar tipo
   * já existente (DECISION-0189A §3), espelhando PATCH /events/:id em core/events/event.routes.ts.
   */
  fastify.patch<{
    Params: { id: string; ticketId: string };
    Body: UpdateEventTicketInput;
  }>('/events/:id/tickets/:ticketId', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const event = await eventRepository.getEventById(tenantId, req.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Evento não encontrado' });
    }
    if (!(await userCanActOnEventOwner(tenantId, userId, event.organizerActorId, 'manage_events'))) {
      return reply.status(403).send({ error: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED', code: 'EVENT_TICKET_TYPE_ACTOR_NOT_AUTHORIZED' });
    }

    // Anti-IDOR: o tipo de ingresso deve pertencer ao evento declarado no path.
    const existingTicket = await eventTicketRepository.getTicketById(tenantId, req.params.ticketId);
    if (!existingTicket || existingTicket.eventId !== req.params.id) {
      return reply.status(404).send({ error: 'Tipo de ingresso não encontrado neste evento' });
    }

    try {
      const updated = await ticketService.updateTicketType(tenantId, req.params.ticketId, req.body);
      return reply.send(updated);
    } catch (error) {
      return reply.status(400).send({
        error: 'Erro ao atualizar tipo de ingresso',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /tickets/:id/reserve
   * Reserva ingresso (cria PaymentIntent)
   */
  fastify.post<{
    Params: { id: string };
    Body: ReserveTicketInput;
  }>('/tickets/:id/reserve', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    // 🔴 F-CAMADA-1-GATE-ACTIONCTX (DECISION-0113): actionContext.actorId é HINT, NÃO autoridade.
    // Reserva cria PaymentIntent (money-adjacent) — caller deve poder representar o actor antes de qualquer trilho de dinheiro.
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    if (!(await authorizationService.canRepresentActor(tenantId, userId, actionContext.actorId))) {
      return reply.status(403).send({ error: 'ACTOR_REPRESENTATION_DENIED', code: 'ACTOR_REPRESENTATION_DENIED' });
    }

    const result = await ticketService.reserveTicket(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId,
      userId
    );

    return reply.status(201).send(result);
  });

  /**
   * POST /tickets/:id/pay
   * Confirma pagamento de ingresso
   */
  fastify.post<{ Params: { id: string } }>('/tickets/:id/pay', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;

    const ticketSale = await ticketService.confirmTicketPayment(tenantId, req.params.id);

    return reply.send(ticketSale);
  });

  /**
   * POST /tickets/:id/cancel
   * Cancela ingresso reservado
   */
  fastify.post<{
    Params: { id: string };
    Body: { cancellationReason?: string };
  }>('/tickets/:id/cancel', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const ticketSale = await ticketService.cancelTicket(
      tenantId,
      req.params.id,
      actionContext.actorId,
      actionContext.actorId,
      req.body.cancellationReason
    );

    return reply.send(ticketSale);
  });

  // ============================================================
  // CHECK-IN / CHECK-OUT
  // ============================================================

  /**
   * POST /checkin/:ticketSaleId
   * Realiza check-in
   */
  fastify.post<{ Params: { ticketSaleId: string } }>('/checkin/:ticketSaleId', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const checkIn = await checkInService.checkIn(
      tenantId,
      req.params.ticketSaleId,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(201).send(checkIn);
  });

  /**
   * POST /checkout/:ticketSaleId
   * Realiza check-out
   */
  fastify.post<{ Params: { ticketSaleId: string } }>('/checkout/:ticketSaleId', async (req, reply) => {
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant é obrigatório' });
    }
    const tenantId = req.tenant.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const checkOut = await checkInService.checkOut(
      tenantId,
      req.params.ticketSaleId,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.send(checkOut);
  });
};

export default eventsSprint76Routes;






