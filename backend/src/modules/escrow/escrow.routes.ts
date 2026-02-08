// backend/src/modules/escrow/escrow.routes.ts
// Rotas para Pagamentos com Escrow e Marcos de Execução
// 🔴 BLINDAGEM: Nenhum pagamento sem Agreement FINALIZED

import type { FastifyInstance } from 'fastify';
import { escrowService } from './escrow.service';
import type {
  CreateEscrowInput,
  AuthorizeMilestoneInput,
  ReleasePaymentInput,
  RefundInput,
} from './escrow.types';

const escrowRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /escrow
   * Cria escrow account a partir de Agreement FINALIZED
   */
  fastify.post<{ Body: CreateEscrowInput }>('/escrow', async (req, reply) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id || null;

    // Buscar evidence pack do agreement (se existir)
    const { evidenceService } = await import('../evidence/evidence.service');
    let evidencePackId: string | null = null;
    try {
      const pack = await evidenceService.getPackByContext(
        tenantId,
        'agreement',
        req.body.agreementId
      );
      evidencePackId = pack?.packId || null;
    } catch (err) {
      // Se não existir, continuar sem evidence pack
      console.warn('Erro ao buscar evidence pack:', err);
    }

    const escrow = await escrowService.createEscrowFromAgreement(
      tenantId,
      req.body,
      evidencePackId
    );

    return reply.status(201).send({ escrow });
  });

  /**
   * GET /escrow/:escrowId
   * Busca escrow account por ID
   */
  fastify.get<{ Params: { escrowId: string } }>('/escrow/:escrowId', async (req, reply) => {
    const tenantId = req.tenant.id;
    const escrow = await escrowService.getEscrowAccount(tenantId, req.params.escrowId);

    return reply.send({ escrow });
  });

  /**
   * GET /escrow/agreement/:agreementId
   * Busca escrow account por agreement
   */
  fastify.get<{ Params: { agreementId: string } }>(
    '/escrow/agreement/:agreementId',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const escrow = await escrowService.getEscrowByAgreement(tenantId, req.params.agreementId);

      if (!escrow) {
        return reply.status(404).send({ error: 'Escrow account não encontrado' });
      }

      return reply.send({ escrow });
    }
  );

  /**
   * GET /escrow
   * Lista escrow accounts com filtros
   */
  fastify.get<{
    Querystring: {
      agreementId?: string;
      serviceOrderId?: string;
      bundleId?: string;
      status?: string;
      disputeStatus?: string;
      limit?: number;
      offset?: number;
    };
  }>('/escrow', async (req, reply) => {
    const tenantId = req.tenant.id;
    const filters = {
      agreementId: req.query.agreementId,
      serviceOrderId: req.query.serviceOrderId,
      bundleId: req.query.bundleId,
      status: req.query.status as any,
      disputeStatus: req.query.disputeStatus as any,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const escrows = await escrowService.listEscrowAccounts(tenantId, filters);

    return reply.send({ escrows, totalCents: escrows.length });
  });

  /**
   * GET /escrow/:escrowId/milestones
   * Lista milestones de um escrow
   */
  fastify.get<{ Params: { escrowId: string } }>(
    '/escrow/:escrowId/milestones',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const milestones = await escrowService.listMilestones(tenantId, req.params.escrowId);

      return reply.send({ milestones });
    }
  );

  /**
   * GET /escrow/:escrowId/transactions
   * Lista transações de um escrow
   */
  fastify.get<{ Params: { escrowId: string } }>(
    '/escrow/:escrowId/transactions',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const transactions = await escrowService.listTransactions(tenantId, req.params.escrowId);

      return reply.send({ transactions });
    }
  );

  /**
   * POST /escrow/:escrowId/authorize-milestone
   * Autoriza milestone (muda status para AUTHORIZED)
   */
  fastify.post<{ Params: { escrowId: string }; Body: AuthorizeMilestoneInput }>(
    '/escrow/:escrowId/authorize-milestone',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const milestone = await escrowService.authorizeMilestone(tenantId, req.params.escrowId, {
        ...req.body,
        authorizedByUserId: userId,
      });

      return reply.send({ milestone });
    }
  );

  /**
   * POST /escrow/:escrowId/release-payment
   * Libera pagamento de um milestone
   */
  fastify.post<{ Params: { escrowId: string }; Body: ReleasePaymentInput }>(
    '/escrow/:escrowId/release-payment',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const result = await escrowService.releasePayment(tenantId, req.params.escrowId, {
        ...req.body,
        releasedByUserId: userId,
      });

      return reply.send(result);
    }
  );

  /**
   * POST /escrow/:escrowId/refund
   * Reembolsa fundos
   */
  fastify.post<{ Params: { escrowId: string }; Body: RefundInput }>(
    '/escrow/:escrowId/refund',
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const result = await escrowService.refundFunds(tenantId, req.params.escrowId, {
        ...req.body,
        refundedByUserId: userId,
      });

      return reply.send(result);
    }
  );

  /**
   * POST /escrow/:escrowId/sync-dispute-status
   * Sincroniza status de disputa com EvidencePack
   */
  fastify.post<{
    Params: { escrowId: string };
    Body: { disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED' };
  }>('/escrow/:escrowId/sync-dispute-status', async (req, reply) => {
    const tenantId = req.tenant.id;
    const escrow = await escrowService.syncDisputeStatus(
      tenantId,
      req.params.escrowId,
      req.body.disputeStatus
    );

    return reply.send({ escrow });
  });
};

export default escrowRoutes;





