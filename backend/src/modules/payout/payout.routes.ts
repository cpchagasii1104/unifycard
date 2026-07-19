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

  // 🔒 DECISION-0189B D2 — GET /payouts/orders DESATIVADO enquanto a PORTA 01 estiver fechada.
  // Resposta UNIFORME 503 `{ code: 'PORTA_01_CLOSED' }`, idêntica com e sem `actorId`. NÃO lista
  // orders do tenant, NÃO trata ausência de `actorId` como "listar tudo", NÃO reutiliza
  // `financial:execute_payout` como permissão de LEITURA (a chave está em PORTA_HOLD — o gate de
  // leitura correto é frente própria da abertura da PORTA 01: PermissionKey de leitura própria +
  // filtro obrigatório por actor/empresa + recurso server-side + view_financial + audit + no-store).
  // `payoutService.listOrders` está FORA do caminho vivo desta rota (guard trava reintrodução).
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
  }>('/payouts/orders', async (_req, reply) => {
    return reply.status(503).send({ code: 'PORTA_01_CLOSED' });
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
