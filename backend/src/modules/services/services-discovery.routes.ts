import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { servicesDiscoveryService } from './services-discovery.service';
import { AppError } from '@core/errors';
import { isServiceFinancialRuntimeEnabled, serviceFinancialDisabledBody } from './service-financial-firewall';
import { serviceDiscoveryTrackRetiredBody } from './service-discovery-request-track-retirement';

// 🔵 F-SERVICE-SEARCH-ALIAS-DISCOVERY: busca por TERMO livre de ocupação ("cabeleireiro").
// term é texto livre (não uuid) — resolvido a concept(s) via ponte advisory, nunca persistido.
const searchByTermQuerySchema = z.object({
  term: z.string().min(1).max(120),
  cityId: z.string().uuid().optional(),
});

function zodBadRequest(reply: FastifyReply, err: ZodError) {
  return reply.status(400).send({
    error: 'Invalid request',
    details: err.errors,
  });
}

const servicesDiscoveryRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔴 R8P canal-1 BIND (DECISION-0113 / Z2 · 2026-06-19) — SUPERSEDED por DECISION-0156 D5+D6
  // (2026-07-02): as 6 rotas actor-scoped que este bind protegia (/offers, /request, /request/respond,
  // /my-requests, /provider-requests, /request/:requestId) foram APOSENTADAS INCONDICIONALMENTE
  // (F-SERVICE-DISCOVERY-REQUEST-TRACK-RETIREMENT — ver service-discovery-request-track-retirement.ts).
  // Não há mais write/leitura actor-scoped alcançável por elas — o bind de autoridade (assertActor
  // Representable/canRepresentActor) ficou sem propósito (nada para proteger) e foi removido. A
  // preocupação de autoridade do R8P não regrediu: ela desapareceu porque o alvo que ela protegia
  // desapareceu. Guard audit-services-discovery-actor-bind.mjs reescrito para verificar a
  // aposentadoria incondicional das 6 rotas em vez do bind (mesmo arquivo, mesmo wiring em
  // validate:regression-guards, conteúdo/propósito atualizado).

  fastify.post('/offers', async (_req, reply) => {
    // 🔴 DECISION-0156 D5: createOffer grava services.metadata.availability (blob JSON) — 2ª fonte de
    // TEMPO (SSOT temporal é a Unified Availability). Aposentado incondicionalmente. createOffer
    // permanece no service, intocado e INALCANÇÁVEL por esta rota.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('POST /services/offers'));
  });

  fastify.get('/metrics', async (_req, reply) => {
    // 🔴 DECISION-0156 D6: métricas derivadas exclusivamente de service_discovery_requests (2ª fonte
    // de ESTADO, aposentada). Aposentado incondicionalmente junto com o trilho que mede.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('GET /services/metrics'));
  });

  fastify.get('/search', async (_req, reply) => {
    // 🔴 DECISION-0156 D5: com datetime, filtra via isTimeInAvailability contra o blob (2ª fonte de
    // TEMPO, bug de fuso incluso); sem datetime, duplica GET /services/discover (SSOT canônico,
    // F-SERVICE-DISCOVERY-FUTURE-AVAILABILITY-SLICE-B). Aposentado incondicionalmente nos dois casos.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('GET /services/search'));
  });

  // 🔵 F-SERVICE-SEARCH-ALIAS-DISCOVERY: GET /services/search-by-term — descoberta por TERMO livre
  // de ocupação ("cabeleireiro", "barbeiro"). Espelha /search (ungated p/ representação: descoberta
  // é leitura; exige só actionContext+tenant). O termo é resolvido a concept(s) via ponte advisory
  // service_search_aliases (READ-ONLY) e reusa a descoberta concept-keyed. NÃO toca a publicação gated
  // (/services/offerable, DECISION-0144): descobrir uma oferta ≠ poder publicá-la. Miss → results vazio.
  fastify.get('/search-by-term', async (req, reply) => {
    if (!req.actionContext?.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    let query: z.output<typeof searchByTermQuerySchema>;
    try {
      query = searchByTermQuerySchema.parse(req.query);
    } catch (e) {
      if (e instanceof ZodError) {
        return zodBadRequest(reply, e);
      }
      throw e;
    }

    try {
      const data = await servicesDiscoveryService.searchByTerm(req.tenant.id, {
        term: query.term,
        cityId: query.cityId ?? null,
      });
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'services-discovery search-by-term');
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(500).send({
        error: 'Erro na busca por termo',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  fastify.get('/my-requests', async (_req, reply) => {
    // 🔴 DECISION-0156 D6: lê service_discovery_requests (2ª fonte de ESTADO). Aposentado
    // incondicionalmente junto com o trilho de escrita.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('GET /services/my-requests'));
  });

  fastify.get('/provider-requests', async (_req, reply) => {
    // 🔴 DECISION-0156 D6: lê service_discovery_requests (2ª fonte de ESTADO). Aposentado
    // incondicionalmente junto com o trilho de escrita.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('GET /services/provider-requests'));
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

  fastify.post('/request/respond', async (_req, reply) => {
    // 🔴 DECISION-0156 D6: escreve service_discovery_requests (2ª fonte de ESTADO). Aposentado
    // incondicionalmente.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('POST /services/request/respond'));
  });

  fastify.get<{ Params: { requestId: string } }>('/request/:requestId', async (_req, reply) => {
    // 🔴 DECISION-0156 D6: lê service_discovery_requests (2ª fonte de ESTADO). Aposentado
    // incondicionalmente junto com o trilho de escrita.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('GET /services/request/:requestId'));
  });

  fastify.post('/request', async (_req, reply) => {
    // 🔴 DECISION-0156 D5+D6: valida contra o blob (services.metadata.availability, 2ª fonte de
    // TEMPO) E escreve service_discovery_requests (2ª fonte de ESTADO). Aposentado incondicionalmente.
    // createRequest permanece no service, intocado e INALCANÇÁVEL por esta rota.
    return reply.status(403).send(serviceDiscoveryTrackRetiredBody('POST /services/request'));
  });
};

export default servicesDiscoveryRoutes;