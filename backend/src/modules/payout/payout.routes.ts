// backend/src/modules/payout/payout.routes.ts
// Rotas para Payout Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { payoutService } from './payout.service';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

// 🔒 F-ACTOR-WALLET-PAYOUT-WIRING (DECISION-0128): os writers move-money/estado-financeiro de payout
// (POST /payouts/batches, /orders/:id/execute-manual, /orders/:id/fail) são EXECUÇÃO/BATCH/FAIL-SETTLEMENT —
// FAIL-CLOSED (403 PAYOUT_HTTP_EXECUTION_DISABLED). Não chamam payoutService executor, não movem dinheiro,
// não criam settlement, não marcam payout pago/executado. A execução real (após aprovação no Core, com
// revalidação de saldo no Bank + bloqueio por recovery obligations + locks + idempotência) é frente FUTURA
// (F-PAYOUT-EXECUTION-SEAL). availableBalanceCents/seller_available NÃO autorizam payout. Os GET readers
// seguem gateados por requirePayoutPermission (subject server-side = req.user; actorId = filtro de leitura).
const PAYOUT_HTTP_EXECUTION_DISABLED = {
  ok: false,
  code: 'PAYOUT_HTTP_EXECUTION_DISABLED',
  message:
    'Payout execution through HTTP is disabled. Execution requires the Financial Approval Core (request → approval → execution with balance revalidation, recovery-obligation block and locks), not implemented yet (DECISION-0128).',
} as const;

const payoutRoutes = async (fastify: FastifyInstance) => {
  const requirePayoutPermission = async (req: any, _reply: any) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    try {
      const { businessAuthorizationService } = await import(
        '@core/authorization/business-authorization.service'
      );
      const { getActiveActor } = await import('@core/actors/actor.helpers');

      const actor = await getActiveActor(tenantId, userId);
      if (!actor) {
        throw new ForbiddenError('Actor not found', ErrorCode.MISSING_ACTOR);
      }

      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:execute_payout',
        'payout'
      );
    } catch (e) {
      if (e instanceof ForbiddenError || e instanceof UnauthorizedError) throw e;
      throw new ForbiddenError('No permission to access payouts', ErrorCode.PERMISSION_DENIED);
    }
  };

  // 🔴 FAIL-CLOSED — batch executor (não executa dinheiro; não cria batch/orders).
  fastify.post(
    '/payouts/batches',
    { preHandler: requirePayoutPermission },
    async (_req, reply) => reply.status(403).send(PAYOUT_HTTP_EXECUTION_DISABLED)
  );

  fastify.get<{
    Querystring: {
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/payouts/batches', { preHandler: requirePayoutPermission }, async (req, reply) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;
    const filters = {
      status: req.query.status as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const batches = await payoutService.listBatches(tenantId, filters);

    return reply.send({ batches, totalCents: batches.length });
  });

  fastify.get<{ Params: { batchId: string } }>(
    '/payouts/batches/:batchId',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
      const tenantId = req.tenant.id;
      const batch = await payoutService.getBatchById(tenantId, req.params.batchId);

      return reply.send({ batch });
    }
  );

  fastify.get<{
    Querystring: {
      batchId?: string;
      actorId?: string;
      status?: string;
      payoutMethod?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/payouts/orders', { preHandler: requirePayoutPermission }, async (req, reply) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;

    // 🔵 DECISION-0113 canal 3 — CORREÇÃO DE OVER-GATE (2026-06-08): a rota é gateada (preHandler) por
    // `financial:execute_payout` (operador financeiro: papel OWNER/ADMIN/FINANCE + capability `can_hold_assets`).
    // PROVA ESTRUTURAL do over-gate: `GET /payouts/orders` SEM `actorId` já chama `listOrders(tenantId, {})` e
    // retorna TODAS as orders do tenant ao operador autorizado; o `?actorId` é só um SUBCONJUNTO. Exigir
    // `canRepresentActor` apenas no subconjunto bloqueava o operador legítimo de filtrar dado que ele já vê sem
    // filtro — incoerente (filtro mais restritivo que a rota sem filtro). `actorId` aqui é FILTRO de leitura, não
    // vetor de spoof. NOTA: isolamento multi-empresa (operador da empresa A não ver payouts da empresa B) NÃO se
    // resolve aqui — seria a rota unfiltered, frente própria `F-PAYOUT-COMPANY-SCOPING` (fora desta fatia).
    const filters = {
      batchId: req.query.batchId,
      actorId: req.query.actorId,
      status: req.query.status as any,
      payoutMethod: req.query.payoutMethod as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const orders = await payoutService.listOrders(tenantId, filters);

    return reply.send({ orders, totalCents: orders.length });
  });

  fastify.get<{ Params: { orderId: string } }>(
    '/payouts/orders/:orderId',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
      const tenantId = req.tenant.id;
      const order = await payoutService.getOrderById(tenantId, req.params.orderId);

      return reply.send({ order });
    }
  );

  // 🔴 FAIL-CLOSED — execução manual de payout (não executa dinheiro; não marca order executada/paga).
  fastify.post<{ Params: { orderId: string } }>(
    '/payouts/orders/:orderId/execute-manual',
    { preHandler: requirePayoutPermission },
    async (_req, reply) => reply.status(403).send(PAYOUT_HTTP_EXECUTION_DISABLED)
  );

  // 🔴 FAIL-CLOSED — fail/settlement de payout (não move dinheiro; não cria settlement; não muda estado financeiro).
  fastify.post<{ Params: { orderId: string } }>(
    '/payouts/orders/:orderId/fail',
    { preHandler: requirePayoutPermission },
    async (_req, reply) => reply.status(403).send(PAYOUT_HTTP_EXECUTION_DISABLED)
  );
};

export default payoutRoutes;
