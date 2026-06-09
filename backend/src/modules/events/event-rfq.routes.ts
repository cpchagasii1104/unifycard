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
        // Buscar RFQ
        const rfq = await eventRFQService.getRFQById(tenantId, eventId, rfqId);
        if (!rfq) {
          return reply.status(404).send({ error: 'RFQ não encontrado' });
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
   */
  fastify.post<{ Params: { eventId: string; rfqId: string; quoteId: string } }>(
    '/events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept',
    async (req, reply) => {
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

