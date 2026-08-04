// backend/src/modules/events/event-rfq.routes.ts
// Rotas para RFQ (Request for Quotation) / ORÇAMENTO EM LOTE

import type { FastifyInstance } from 'fastify';
import { eventRFQService } from './event-rfq.service';
import { eventRFQMatchingService } from './event-rfq-matching.service';
import { eventRFQOpportunityService } from './event-rfq-opportunity.service';
import { eventSpecService } from '@core/events/specs/event-spec.service';
import { mapEventSpecToCreateRFQInput } from '@core/events/specs/event-spec-to-rfq.mapper';
import type {
  CreateEventRFQInput,
  CreateQuoteResponseInput,
} from './event-rfq.types';

const eventRFQRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /events/:eventId/rfqs
   * Cria novo RFQ para um evento
   */
  fastify.post<{ Params: { eventId: string }; Body: Omit<CreateEventRFQInput, 'eventId'> }>(
    '/events/:eventId/rfqs',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const { eventId } = req.params;
      const body = req.body;

      try {
        // 🔴 R7a EVENT-RFQ ACTING-USER-GATE (DECISION-0113/0131 §B7 / Z2): actionContext.actorId é HINT/target,
        // NUNCA autoridade. Subject soberano = req.user.userId (server-side); prova de representação do organizer
        // DECLARADO via canRepresentActor ANTES do write. Non-money-runtime (não materializa payment_request).
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        if (!callerUserId) {
          return reply.status(401).send({ error: 'Autenticação obrigatória', code: 'AUTH_REQUIRED' });
        }
        const { authorizationService } = await import('@core/authorization/authorization.service');
        const canRep = await authorizationService.canRepresentActor(req.tenant.id, callerUserId, actionContext.actorId);
        if (!canRep) {
          return reply.status(403).send({ error: 'Sem autoridade para representar o organizer declarado', code: 'EVENT_RFQ_ACTOR_NOT_REPRESENTABLE' });
        }

        const result = await eventRFQService.createRFQ(
          tenantId,
          actionContext.actorId,
          {
            ...body,
            eventId,
          },
          actionContext.actingUserId
        );

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao criar RFQ',
        });
      }
    }
  );

  /**
   * GET /events/:eventId/rfqs
   * Lista RFQs de um evento
   */
  fastify.get<{ Params: { eventId: string } }>(
    '/events/:eventId/rfqs',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const { eventId } = req.params;

      try {
        // 🔴 DECISION-0113 F6.5.6b-EVENTS-MONEY-READS: RFQ é procurement/termos → autoridade do organizer.
        // Camada dupla: invisível/inexistente → 404; visível mas sem representar o organizer → 403.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
          });
        }
        const result = await eventRFQService.getEventRFQs(tenantId, eventId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao buscar RFQs',
        });
      }
    }
  );

  /**
   * GET /events/:eventId/rfqs/:rfqId
   * Busca RFQ por ID
   */
  fastify.get<{ Params: { eventId: string; rfqId: string } }>(
    '/events/:eventId/rfqs/:rfqId',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const { eventId, rfqId } = req.params;

      try {
        // 🔴 DECISION-0113 F6.5.6b-EVENTS-MONEY-READS: RFQ individual herda a autoridade do evento-pai (eventId no path).
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
          });
        }
        const rfq = await eventRFQService.getRFQById(tenantId, eventId, rfqId);
        if (!rfq) {
          return reply.status(404).send({ error: 'RFQ não encontrado' });
        }
        return reply.send({ rfq });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao buscar RFQ',
        });
      }
    }
  );

  /**
   * POST /events/:eventId/rfqs/:rfqId/close
   * Fecha RFQ (não aceita mais propostas)
   */
  fastify.post<{ Params: { eventId: string; rfqId: string } }>(
    '/events/:eventId/rfqs/:rfqId/close',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const { eventId, rfqId } = req.params;

      try {
        // 🔴 R7a EVENT-RFQ ACTING-USER-GATE: closeRFQ MUTA recurso existente do organizer → autoridade
        // resolvida SERVER-SIDE a partir do evento (event.actor_id), NUNCA de actionContext.actorId.
        // assertCanReadEventMoney (DECISION-0113 F6.5.6b) resolve o organizer e exige canRepresentActor.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
            ...(auth.status === 403 ? { code: 'EVENT_RFQ_ACTOR_NOT_REPRESENTABLE' } : {}),
          });
        }

        const rfq = await eventRFQService.closeRFQ(
          tenantId,
          eventId,
          rfqId,
          actionContext.actorId
        );
        return reply.send({ rfq });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao fechar RFQ',
        });
      }
    }
  );

  /**
   * POST /events/:eventId/rfqs/:rfqId/quotes
   * Cria proposta (Quote) para um RFQ
   */
  fastify.post<{ Params: { eventId: string; rfqId: string }; Body: Omit<CreateQuoteResponseInput, 'rfqId'> }>(
    '/events/:eventId/rfqs/:rfqId/quotes',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const { eventId, rfqId } = req.params;
      const body = req.body;

      try {
        // 🔴 R7a EVENT-RFQ ACTING-USER-GATE: createQuote cria proposta "como" um provider DECLARADO →
        // actionContext.actorId é HINT/target; subject = req.user.userId; canRepresentActor ANTES do write.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        if (!callerUserId) {
          return reply.status(401).send({ error: 'Autenticação obrigatória', code: 'AUTH_REQUIRED' });
        }
        const { authorizationService } = await import('@core/authorization/authorization.service');
        const canRep = await authorizationService.canRepresentActor(req.tenant.id, callerUserId, actionContext.actorId);
        if (!canRep) {
          return reply.status(403).send({ error: 'Sem autoridade para representar o provider declarado', code: 'EVENT_RFQ_ACTOR_NOT_REPRESENTABLE' });
        }

        const quote = await eventRFQService.createQuote(
          tenantId,
          eventId,
          actionContext.actorId,
          {
            ...body,
            rfqId,
          },
          actionContext.actingUserId
        );
        return reply.status(201).send({ quote });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao criar proposta',
        });
      }
    }
  );

  /**
   * GET /events/:eventId/rfqs/:rfqId/quotes
   * Lista propostas de um RFQ
   */
  fastify.get<{ Params: { eventId: string; rfqId: string } }>(
    '/events/:eventId/rfqs/:rfqId/quotes',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const { eventId, rfqId } = req.params;

      try {
        // 🔴 DECISION-0113 F6.5.6b-EVENTS-MONEY-READS: quotes = propostas/preços (dado financeiro) → autoridade do organizer.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
          });
        }
        const result = await eventRFQService.getRFQQuotes(tenantId, eventId, rfqId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao buscar propostas',
        });
      }
    }
  );

  /**
   * POST /events/:eventId/rfqs/from-spec/:specId
   * Cria RFQ a partir de EventSpec
   * ⚠️ REGRAS: Organizador opta explicitamente por criar RFQ
   */
  fastify.post<{ Params: { eventId: string; specId: string } }>(
    '/events/:eventId/rfqs/from-spec/:specId',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const { eventId, specId } = req.params;

      try {
        // 🔴 R7a EVENT-RFQ ACTING-USER-GATE: from-spec MUTA declaration + cria RFQ no evento existente →
        // autoridade resolvida SERVER-SIDE pelo organizer do evento (event.actor_id), não por igualdade
        // contra actionContext.actorId spoofável. assertCanReadEventMoney exige canRepresentActor ANTES do write.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
            ...(auth.status === 403 ? { code: 'EVENT_RFQ_ACTOR_NOT_REPRESENTABLE' } : {}),
          });
        }

        // Buscar EventSpec
        const eventSpec = await eventSpecService.getEventSpecById(tenantId, specId);
        
        // 🔴 P0-3: Atualizar Event.declaration com dados do EventSpec (ANTES de criar RFQ)
        const { updateEventDeclarationFromSpec } = await import('@core/events/event-spec-orchestration.service');
        await updateEventDeclarationFromSpec(
          tenantId,
          eventId,
          specId,
          actionContext.actorId
        );
        
        // Converter EventSpec em CreateEventRFQInput
        const rfqInput = mapEventSpecToCreateRFQInput(eventSpec, eventId);

        // Criar RFQ
        const result = await eventRFQService.createRFQ(
          tenantId,
          actionContext.actorId,
          rfqInput,
          actionContext.actingUserId
        );

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao criar RFQ a partir de EventSpec',
        });
      }
    }
  );

  /**
   * GET /events/:eventId/rfqs/:rfqId/compatible-companies
   * Busca empresas compatíveis para um RFQ (SUGESTÃO)
   * ⚠️ REGRAS: Retorna lista simples, não ordenada, não pontuada
   */
  fastify.get<{ Params: { eventId: string; rfqId: string } }>(
    '/events/:eventId/rfqs/:rfqId/compatible-companies',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const { eventId, rfqId } = req.params;

      try {
        // 🔴 DECISION-0113 F6.5.6b-EVENTS-MONEY-READS: lista de empresas compatíveis é procurement do RFQ → autoridade do organizer.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
          });
        }
        // Buscar RFQ
        const rfq = await eventRFQService.getRFQById(tenantId, eventId, rfqId);
        if (!rfq) {
          return reply.status(404).send({ error: 'RFQ não encontrado' });
        }

        // Buscar empresas compatíveis (SUGESTÃO)
        const companies = await eventRFQMatchingService.findCompatibleCompaniesForRFQ(
          tenantId,
          rfq
        );

        return reply.send({
          companies,
          note: 'Esta é uma SUGESTÃO baseada em compatibilidade técnica. Organizador escolhe manualmente quais empresas notificar.',
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao buscar empresas compatíveis',
        });
      }
    }
  );

  /**
   * POST /events/:eventId/rfqs/:rfqId/dispatch
   * Dispara oportunidades para empresas selecionadas manualmente
   * ⚠️ REGRAS: Disparo é EXPLÍCITO, organizador escolhe empresas
   */
  fastify.post<{
    Params: { eventId: string; rfqId: string };
    Body: { companyActorIds: string[] };
  }>(
    '/events/:eventId/rfqs/:rfqId/dispatch',
    async (req, reply) => {
      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const { eventId, rfqId } = req.params;
      const { companyActorIds } = req.body;

      if (!companyActorIds || !Array.isArray(companyActorIds) || companyActorIds.length === 0) {
        return reply.status(400).send({ error: 'companyActorIds é obrigatório e deve ser um array não vazio' });
      }

      try {
        // 🔴 R7a EVENT-RFQ ACTING-USER-GATE: dispatch dispara oportunidades do RFQ do evento existente →
        // autoridade resolvida SERVER-SIDE pelo organizer do evento (event.actor_id). actingUserId fantasma
        // (actionContext) deixa de ser autoridade. assertCanReadEventMoney exige canRepresentActor ANTES do write.
        const callerUserId = (req.user as { userId?: string } | undefined)?.userId;
        const { assertCanReadEventMoney } = await import('@core/events/event-visibility.service');
        const auth = await assertCanReadEventMoney(tenantId, eventId, callerUserId);
        if (!auth.ok) {
          return reply.status(auth.status).send({
            error: auth.status === 404 ? 'Evento não encontrado' : 'Sem autoridade sobre o organizer do evento',
            ...(auth.status === 403 ? { code: 'EVENT_RFQ_ACTOR_NOT_REPRESENTABLE' } : {}),
          });
        }

        // Buscar RFQ
        const rfq = await eventRFQService.getRFQById(tenantId, eventId, rfqId);
        if (!rfq) {
          return reply.status(404).send({ error: 'RFQ não encontrado' });
        }

        // 🔴 CONTENÇÃO POR SONDA (2026-08-04) — ANTES de qualquer sink, DEPOIS da autoridade.
        // `dispatchRFQToCompanies` escreve em `opportunity_dispatches`, e essa tabela NÃO EXISTE
        // neste banco (medido: `to_regclass` → null). O organizador legítimo recebia 500 (42P01):
        // o caminho autorizava e morria. Agora recebe erro NOMEADO dizendo o que falta.
        //
        // A ordem importa: a checagem vem DEPOIS de `assertCanReadEventMoney` de propósito — quem
        // não tem autoridade continua recebendo 403, e não descobre o estado do substrato por
        // sondagem. Contenção não pode virar canal de informação para quem não podia perguntar.
        const { opportunityDispatchSubstrateExists, opportunityDispatchUnavailableBody } =
          await import('@modules/dispatch/opportunity-dispatch-substrate-probe');
        if (!(await opportunityDispatchSubstrateExists(tenantId))) {
          return reply
            .status(501)
            .send(opportunityDispatchUnavailableBody('POST /events/:eventId/rfqs/:rfqId/dispatch'));
        }

        // Disparar oportunidades para empresas selecionadas
        const result = await eventRFQOpportunityService.dispatchRFQToCompanies(
          tenantId,
          actionContext.actingUserId || '',
          rfq,
          companyActorIds
        );

        return reply.send({
          dispatched: result.dispatched,
          errors: result.errors,
          note: 'Oportunidades disparadas. Empresas receberão notificação no inbox.',
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao disparar oportunidades',
        });
      }
    }
  );
  /**
   * POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept
   * Q3 — Aceita uma proposta: cria booking + payment request pendente
   * 🔴 BLINDAGEM: NÃO executa pagamento — apenas registra intenção
   * 🔴 R7b ACCEPTQUOTE P0 CONTAINMENT — rota CONTIDA / fail-closed (ver hard-stop abaixo).
   */
  fastify.post<{ Params: { eventId: string; rfqId: string; quoteId: string } }>(
    '/events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept',
    async (req, reply) => {
      // 🔴 R7b ACCEPTQUOTE P0 HARD-STOP FAIL-CLOSED (DECISION-0113/0131 §B7 / Z2 · Clayton 2026-06-18):
      // acceptQuote é MONEY-ADJACENT — confia em actionContext.actorId (HINT, NUNCA autoridade), NÃO chama
      // canRepresentActor, e materializa a cadeia availability → booking → service_booking_decision →
      // service_payment_request PENDING "em nome do provider", sem confirmação do provider, sem transação única,
      // sem idempotência suficiente. Regra de produto (Clayton): aceitar quote = "quero seguir com esta proposta";
      // NÃO autoriza cobrança e o organizer NÃO pode emitir cobrança pelo provider (provider/receiver emite, payer
      // paga). Até existir o fluxo de confirmação do provider (DECISION própria — redesenho R7b), a rota é CONTIDA
      // ANTES de qualquer sink material (events.metadata, availability, booking, decision, payment_request,
      // event_outbox, Bank/Core). O fluxo legado abaixo (incl. o sink `eventRFQService.acceptQuote(...)`)
      // permanece CONTIDO: o guard always-on retorna 403 ANTES dele. O flag é runtime-widened (`true as boolean`)
      // de propósito — mantém o corpo legado type-checked (sem TS unreachable / perda de narrowing) até o
      // redesenho R7b (DECISION própria) substituí-lo; em runtime é sempre true → 403 fail-closed.
      const CONTAINMENT_ACTIVE = true as boolean;
      if (CONTAINMENT_ACTIVE) {
        return reply.status(403).send({
          error: 'Accept quote is temporarily contained pending provider confirmation flow.',
          code: 'EVENT_RFQ_ACCEPT_QUOTE_CONTAINED',
        });
      }

      if (!req.tenant?.id) {
        return reply.status(400).send({ error: 'Tenant é obrigatório' });
      }
      const tenantId = req.tenant.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const { eventId, rfqId, quoteId } = req.params;

      try {
        const result = await eventRFQService.acceptQuote(
          tenantId,
          eventId,
          rfqId,
          quoteId,
          actionContext.actorId,
            (req as any).user?.userId || actionContext.actorId
        );
        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao aceitar proposta',
        });
      }
    }
  );
};

export { eventRFQRoutes };

