import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { servicesDiscoveryMetricsService } from './services-discovery-metrics.service';
import { servicesDiscoveryService } from './services-discovery.service';
import { AppError } from '@core/errors';

const weekdaySchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

const availabilityBlockSchema = z.object({
  weekday: weekdaySchema,
  slots: z.array(z.string().min(1)),
});

const createOfferBodySchema = z.object({
  actorId: z.string().uuid(),
  categoryId: z.string().uuid(),
  description: z.string().min(1).max(8000),
  priceCents: z.number().int().min(0).nullable().optional(),
  availability: z.array(availabilityBlockSchema).min(1),
  cityId: z.string().uuid().nullable().optional(),
});

const searchQuerySchema = z.object({
  categoryId: z.string().uuid(),
  cityId: z.string().uuid().optional(),
  datetime: z.string().min(1).optional(),
});

const listRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const requestBodySchema = z.object({
  offerId: z.string().uuid(),
  datetime: z.string().min(1),
  customerId: z.string().uuid(),
});

const respondBodySchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['accepted', 'rejected']),
});

const payRequestBodySchema = z.object({
  requestId: z.string().uuid(),
});

function zodBadRequest(reply: FastifyReply, err: ZodError) {
  return reply.status(400).send({
    error: 'Invalid request',
    details: err.errors,
  });
}

/** Zod + TS: após `.parse()`, reforçar o contrato esperado pelo serviço (validação runtime já garantida). */
type CreateOfferParsed = Parameters<typeof servicesDiscoveryService.createOffer>[2];
type SearchFiltersParsed = Parameters<typeof servicesDiscoveryService.search>[1];
type ListRequestsFiltersParsed = Parameters<typeof servicesDiscoveryService.listMyRequests>[2];
type PayRequestParsed = Parameters<typeof servicesDiscoveryService.payAcceptedRequest>[2];
type RespondParsed = Parameters<typeof servicesDiscoveryService.respondToRequest>[2];
type CreateRequestParsed = Parameters<typeof servicesDiscoveryService.createRequest>[2];

const servicesDiscoveryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/offers', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let body: CreateOfferParsed;
    try {
      body = createOfferBodySchema.parse(req.body) as CreateOfferParsed;
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const service = await servicesDiscoveryService.createOffer(
        req.tenant.id,
        req.actionContext.actorId,
        body
      );
      return reply.status(201).send({ ok: true, data: service });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery createOffer');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(400).send({
        error: 'Erro ao criar oferta',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.get('/metrics', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const data = await servicesDiscoveryMetricsService.getTenantMetrics(req.tenant.id);
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery metrics');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({
        error: 'Erro ao obter métricas',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.get('/search', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let query: z.output<typeof searchQuerySchema>;
    try {
      query = searchQuerySchema.parse(req.query);
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const filters: SearchFiltersParsed = {
        categoryId: query.categoryId,
        cityId: query.cityId,
        datetime: query.datetime ?? null,
      };
      const list = await servicesDiscoveryService.search(req.tenant.id, filters);
      return reply.send({ ok: true, data: list });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery search');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({
        error: 'Erro na busca',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.get('/my-requests', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let listQuery: ListRequestsFiltersParsed;
    try {
      listQuery = listRequestsQuerySchema.parse(req.query) as ListRequestsFiltersParsed;
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const data = await servicesDiscoveryService.listMyRequests(
        req.tenant.id,
        req.actionContext.actorId,
        listQuery
      );
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery my-requests');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({
        error: 'Erro ao listar pedidos',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.get('/provider-requests', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let providerListQuery: ListRequestsFiltersParsed;
    try {
      providerListQuery = listRequestsQuerySchema.parse(req.query) as ListRequestsFiltersParsed;
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const data = await servicesDiscoveryService.listProviderRequests(
        req.tenant.id,
        req.actionContext.actorId,
        providerListQuery
      );
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery provider-requests');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({
        error: 'Erro ao listar solicitações',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.post('/request/pay', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let payBody: PayRequestParsed;
    try {
      payBody = payRequestBodySchema.parse(req.body) as PayRequestParsed;
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const data = await servicesDiscoveryService.payAcceptedRequest(
        req.tenant.id,
        req.actionContext.actorId,
        payBody
      );
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery pay');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(400).send({
        error: 'Erro ao pagar pedido',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.post('/request/respond', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let respondPayload: RespondParsed;
    try {
      respondPayload = respondBodySchema.parse(req.body) as RespondParsed;
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const data = await servicesDiscoveryService.respondToRequest(
        req.tenant.id,
        req.actionContext.actorId,
        respondPayload
      );
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery respond');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(400).send({
        error: 'Erro ao responder pedido',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.get<{ Params: { requestId: string } }>('/request/:requestId', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const idParse = z.string().uuid().safeParse(req.params.requestId);
    if (!idParse.success) {
      return reply.status(400).send({ error: 'requestId inválido' });
    }

    try {
      const data = await servicesDiscoveryService.getRequest(
        req.tenant.id,
        req.actionContext.actorId,
        idParse.data
      );
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery getRequest');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({
        error: 'Erro ao consultar pedido',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.post('/request', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let createRequestPayload: CreateRequestParsed;
    try {
      createRequestPayload = requestBodySchema.parse(req.body) as CreateRequestParsed;
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const row = await servicesDiscoveryService.createRequest(
        req.tenant.id,
        req.actionContext.actorId,
        createRequestPayload
      );
      return reply.status(201).send({ ok: true, data: row });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery request');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(400).send({
        error: 'Erro ao solicitar serviço',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
};

export default servicesDiscoveryRoutes;