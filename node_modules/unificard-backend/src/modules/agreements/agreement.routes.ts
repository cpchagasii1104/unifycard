// backend/src/modules/agreements/agreement.routes.ts
// Rotas para Negociação Assistida e Registro de Acordos
// 🔴 BLINDAGEM: Nenhum booking/bundle/service-order sem acordo FINALIZED

import type { FastifyInstance } from 'fastify';
import { agreementService } from './agreement.service';
import type {
  CreateAgreementInput,
  UpdateAgreementInput,
  ProposeAgreementInput,
  AcceptAgreementInput,
  FinalizeAgreementInput,
} from './agreement.types';

const agreementRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /agreements
   * Cria um novo Agreement Draft
   */
  fastify.post<{ Body: CreateAgreementInput }>('/agreements', async (req, reply) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id || '';

    const agreement = await agreementService.createAgreement(tenantId, userId, req.body);

    return reply.status(201).send({ agreement });
  });

  /**
   * GET /agreements/:agreementId
   * Busca agreement por ID
   */
  fastify.get<{ Params: { agreementId: string } }>(
    '/agreements/:agreementId',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const agreement = await agreementService.getAgreement(tenantId, req.params.agreementId);

      return reply.send({ agreement });
    }
  );

  /**
   * GET /agreements
   * Lista agreements com filtros
   */
  fastify.get<{
    Querystring: {
      contextType?: string;
      contextId?: string;
      threadId?: string;
      requesterActorId?: string;
      providerActorId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/agreements', async (req, reply) => {
    const tenantId = req.tenant.id;
    const filters = {
      contextType: req.query.contextType as any,
      contextId: req.query.contextId,
      threadId: req.query.threadId,
      requesterActorId: req.query.requesterActorId,
      providerActorId: req.query.providerActorId,
      status: req.query.status as any,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const agreements = await agreementService.listAgreements(tenantId, filters);

    return reply.send({ agreements, total: agreements.length });
  });

  /**
   * GET /agreements/context/:contextType/:contextId/finalized
   * Busca agreement finalizado por contexto
   * 🔴 BLINDAGEM: Usado para validar se pode criar booking/bundle/service-order
   */
  fastify.get<{
    Params: { contextType: string; contextId: string };
  }>('/agreements/context/:contextType/:contextId/finalized', async (req, reply) => {
    const tenantId = req.tenant.id;
    const agreement = await agreementService.getFinalizedAgreementByContext(
      tenantId,
      req.params.contextType,
      req.params.contextId
    );

    if (!agreement) {
      return reply.status(404).send({ error: 'Nenhum acordo finalizado encontrado' });
    }

    return reply.send({ agreement });
  });

  /**
   * PUT /agreements/:agreementId
   * Atualiza Agreement Draft
   */
  fastify.put<{ Params: { agreementId: string }; Body: UpdateAgreementInput }>(
    '/agreements/:agreementId',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.updateAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/:agreementId/propose
   * Propõe acordo (muda status para PROPOSED)
   */
  fastify.post<{ Params: { agreementId: string }; Body: ProposeAgreementInput }>(
    '/agreements/:agreementId/propose',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.proposeAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/:agreementId/accept
   * Aceita acordo (muda status para ACCEPTED)
   */
  fastify.post<{ Params: { agreementId: string }; Body: AcceptAgreementInput }>(
    '/agreements/:agreementId/accept',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.acceptAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/:agreementId/finalize
   * Finaliza acordo (muda status para FINALIZED)
   */
  fastify.post<{ Params: { agreementId: string }; Body: FinalizeAgreementInput }>(
    '/agreements/:agreementId/finalize',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.finalizeAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/validate-closure
   * Valida se pode criar booking/bundle/service-order
   * 🔴 BLINDAGEM: Endpoint usado internamente para validação
   */
  fastify.post<{
    Body: {
      contextType: string;
      contextId: string;
      expectedPriceCents: number;
    };
  }>('/agreements/validate-closure', async (req, reply) => {
    const tenantId = req.tenant.id;
    const validation = await agreementService.validateAgreementForClosure(
      tenantId,
      req.body.contextType,
      req.body.contextId,
      req.body.expectedPriceCents
    );

    return reply.send(validation);
  });
};

export default agreementRoutes;




