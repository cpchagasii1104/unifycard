// backend/src/modules/invoicing/invoice.routes.ts
// Rotas para Invoice Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { invoiceService } from './invoice.service';
import type { CreateInvoiceFromPayoutInput, IssueInvoiceInput, CancelInvoiceInput } from './invoice.types';

const invoiceRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar invoices
   */
  const requireInvoicePermission = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { getActiveActor } = await import('@core/actors/actor.helpers');
      
      const actor = await getActiveActor(tenantId, userId);
      if (!actor) {
        return reply.status(403).send({ error: 'Actor não encontrado' });
      }

      // Verificar permissão para invoices
      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:view_ledger',
        'invoice'
      );
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar invoices' });
    }
  };

  /**
   * POST /invoices/from-payout/:payoutOrderId
   * Cria invoice a partir de payout EXECUTED
   */
  fastify.post<{ Params: { payoutOrderId: string }; Body: CreateInvoiceFromPayoutInput }>(
    '/invoices/from-payout/:payoutOrderId',
    { preHandler: requireInvoicePermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const invoice = await invoiceService.createInvoiceFromPayout(
        tenantId,
        req.params.payoutOrderId,
        req.body
      );

      return reply.status(201).send({ invoice });
    }
  );

  /**
   * GET /invoices/:invoiceId
   * Busca invoice por ID
   */
  fastify.get<{ Params: { invoiceId: string } }>(
    '/invoices/:invoiceId',
    { preHandler: requireInvoicePermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const invoice = await invoiceService.getInvoiceById(tenantId, req.params.invoiceId);

      return reply.send({ invoice });
    }
  );

  /**
   * GET /invoices
   * Lista invoices
   */
  fastify.get<{
    Querystring: {
      actorId?: string;
      recipientActorId?: string;
      payoutOrderId?: string;
      serviceOrderId?: string;
      status?: string;
      invoiceType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/invoices', { preHandler: requireInvoicePermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;

    // 🔴 DECISION-0113 canal 3 (money): o `requireInvoicePermission` gateia a permissão do CALLER (sobre o
    // próprio actor), NÃO autoridade sobre o `actorId`/`recipientActorId` declarado no filtro. Filtrar por
    // actor alheio é cross-user → exige `canRepresentActor` sobre cada actor de parte declarado na query.
    {
      const callerUserId = (req as { user?: { userId?: string } }).user?.userId;
      const declaredParties = [req.query.actorId, req.query.recipientActorId].filter(Boolean) as string[];
      if (declaredParties.length > 0) {
        if (!callerUserId) return reply.status(401).send({ error: 'Não autenticado' });
        const { authorizationService } = await import('@core/authorization/authorization.service');
        for (const partyId of declaredParties) {
          let canRepresent = false;
          try { canRepresent = await authorizationService.canRepresentActor(tenantId, callerUserId, partyId); } catch { canRepresent = false; }
          if (!canRepresent) return reply.status(403).send({ error: 'Sem autoridade sobre o actor filtrado' });
        }
      }
    }

    const filters = {
      actorId: req.query.actorId,
      recipientActorId: req.query.recipientActorId,
      payoutOrderId: req.query.payoutOrderId,
      serviceOrderId: req.query.serviceOrderId,
      status: req.query.status as any,
      invoiceType: req.query.invoiceType as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const invoices = await invoiceService.listInvoices(tenantId, filters);

    return reply.send({ invoices, totalCents: invoices.length });
  });

  /**
   * POST /invoices/:invoiceId/issue
   * Emite invoice (muda status para ISSUED)
   */
  fastify.post<{ Params: { invoiceId: string }; Body: IssueInvoiceInput }>(
    '/invoices/:invoiceId/issue',
    { preHandler: requireInvoicePermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const invoice = await invoiceService.issueInvoice(tenantId, req.params.invoiceId, {
        ...req.body,
        issuedByUserId: userId,
      });

      return reply.send({ invoice });
    }
  );

  /**
   * POST /invoices/:invoiceId/cancel
   * Cancela invoice
   */
  fastify.post<{ Params: { invoiceId: string }; Body: CancelInvoiceInput }>(
    '/invoices/:invoiceId/cancel',
    { preHandler: requireInvoicePermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const invoice = await invoiceService.cancelInvoice(tenantId, req.params.invoiceId, {
        ...req.body,
        cancelledByUserId: userId,
      });

      return reply.send({ invoice });
    }
  );
};

export default invoiceRoutes;





