// backend/src/modules/events/events-sprint76.routes.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

import type { FastifyInstance } from 'fastify';
import { eventService } from './event.service';
import { ticketService } from './ticket.service';
import { checkInService } from './checkin.service';
import type {
  CreateEventInput,
  CreateEventTicketInput,
  ReserveTicketInput,
} from './event.types';

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

    // Converter datas se necessário
    const body = req.body as any;
    if (body.startAt) {
      body.startAt = new Date(body.startAt);
    }
    if (body.endAt) {
      body.endAt = new Date(body.endAt);
    }

    const event = await eventService.createEvent(
      tenantId,
      body,
      actionContext.actorId,
      actionContext.actorId
    );

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

    const filters: any = {};
    if (req.query.organizerActorId) {
      filters.organizerActorId = req.query.organizerActorId;
    }
    if (req.query.locationActorId) {
      filters.locationActorId = req.query.locationActorId;
    }
    if (req.query.status) {
      filters.status = req.query.status;
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

    const events = await eventService.listEvents(tenantId, filters);

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

    const event = await eventService.getEventById(tenantId, req.params.id);

    if (!event) {
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
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const ticket = await ticketService.createTicketType(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(201).send(ticket);
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

    const result = await ticketService.reserveTicket(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId,
      actionContext.actorId
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






