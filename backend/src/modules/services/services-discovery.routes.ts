import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { servicesDiscoveryMetricsService } from './services-discovery-metrics.service';
import { servicesDiscoveryService } from './services-discovery.service';
import { AppError } from '@core/errors';
import { isServiceFinancialRuntimeEnabled, serviceFinancialDisabledBody } from './service-financial-firewall';

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
  // 🔴 R8P canal-1 BIND (DECISION-0113 / Z2 · 2026-06-19): actionContext.actorId é HINT do actor operacional
  // (provider/customer/responder); o serviço só compara/filtra por ele (offer.actorId===actionActorId,
  // provider_actor_id===actionActorId, customer===actionActorId). Sem prova de representação, qualquer caller
  // declara o public actor id de outro e age/lê como ele. BIND: o caller (req.user) DEVE representar o actor
  // declarado (canRepresentActor server-side) ANTES de qualquer write/leitura actor-scoped. NÃO toca /request/pay
  // (retired R8J), payAcceptedRequest, firewall, settlement nem bank_*. Guard: audit-services-discovery-actor-bind.mjs.
  const assertActorRepresentable = async (req: any, reply: FastifyReply): Promise<boolean> => {
    if (!req.user?.id) {
      reply.status(401).send({ error: 'SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED', message: 'Não autenticado: subject server-side obrigatório' });
      return false;
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    const canRep = await authorizationService.canRepresentActor(req.tenant.id, req.user.id, req.actionContext.actorId);
    if (!canRep) {
      reply.status(403).send({ error: 'SERVICE_DISCOVERY_ACTOR_AUTHORITY_REQUIRED', message: 'Caller não pode representar o actor declarado' });
      return false;
    }
    return true;
  };

  fastify.post('/offers', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    if (!(await assertActorRepresentable(req, reply))) return reply;

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
    if (!(await assertActorRepresentable(req, reply))) return reply;

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
    if (!(await assertActorRepresentable(req, reply))) return reply;

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

  fastify.post('/request/pay', async (_req, reply) => {
    // 🔴 R8J SERVICES-DISCOVERY DIRECT-PAY RETIREMENT (DECISION-0110 D2 · 2026-06-19):
    // (1) firewall geral (default OFF) PRESERVADO — consistência com as demais rotas financeiras de serviço.
    if (!isServiceFinancialRuntimeEnabled()) {
      return reply.status(403).send(serviceFinancialDisabledBody('POST /services/request/pay'));
    }
    // (2) Mesmo com o firewall ON, o pagamento DIRETO legado está APOSENTADO INCONDICIONALMENTE: o trilho
    // payAcceptedRequest → bankTx.createSimpleTransaction → bank_ledger/bank_transactions está FORA da política
    // canônica (DECISION-0110 D2) e lia actionContext.actorId (client-declared) SEM canRepresentActor antes do
    // sink. Esta rota NUNCA mais alcança payAcceptedRequest: o canal-1 (actionContext.actorId), o parse do body
    // e a chamada ao sink foram REMOVIDOS do handler. Flipar o firewall NÃO reabre o trilho direto — reabertura
    // exige a cadeia canônica D1-D7/D8 (pré-pago→escrow→intent→split→approval→KYB→release) em frente própria.
    // payAcceptedRequest permanece no service, intocado e INALCANÇÁVEL por esta rota. Ver DECISION-0110/0111/0128.
    return reply.status(403).send({
      error: 'SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110',
      code: 'SERVICE_DISCOVERY_DIRECT_PAY_RETIRED_BY_DECISION_0110',
      message:
        'Direct service pay (POST /services/request/pay) is retired by DECISION-0110 D2 (legacy direct trail, ' +
        'out of canonical policy). Reopening requires the canonical financial chain (escrow/intent/split/approval/' +
        'KYB/release) in its own front, not the firewall flag.',
      decision: 'DECISION-0110',
    });
  });

  fastify.post('/request/respond', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    if (!(await assertActorRepresentable(req, reply))) return reply;

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
    if (!(await assertActorRepresentable(req, reply))) return reply;

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
    if (!(await assertActorRepresentable(req, reply))) return reply;

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