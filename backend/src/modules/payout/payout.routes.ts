// backend/src/modules/payout/payout.routes.ts
// Rotas para Payout Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
// O service não é mais importado aqui: com readers em 503 e writers em 403, nenhuma rota deste
// arquivo o alcança. Ele segue intacto no módulo — sumiu a ARESTA, não o código.
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

// 🔒 F-ACTOR-WALLET-PAYOUT-WIRING (DECISION-0128): os writers move-money/estado-financeiro de payout
// (POST /payouts/batches, /orders/:id/execute-manual, /orders/:id/fail) são EXECUÇÃO/BATCH/FAIL-SETTLEMENT —
// FAIL-CLOSED (403 PAYOUT_HTTP_EXECUTION_DISABLED). Não chamam payoutService executor, não movem dinheiro,
// não criam settlement, não marcam payout pago/executado. A execução real (após aprovação no Core, com
// revalidação de saldo no Bank + bloqueio por recovery obligations + locks + idempotência) é frente FUTURA
// (F-PAYOUT-EXECUTION-SEAL). availableBalanceCents/seller_available NÃO autorizam payout.
// ⚠️ CORRIGIDO 2026-08-01: esta nota dizia "Os GET readers seguem gateados por
// requirePayoutPermission". **Deixou de ser verdade** — todos os readers agora devolvem 503
// `PORTA_01_CLOSED` uniforme, sem preHandler, sob a DECISION-0189B D2. O preHandler saiu de
// propósito: 403 para quem não tem a chave e 503 para quem tem vazaria quem a detém.
// `requirePayoutPermission` segue vivo — só nos writers fail-closed (403).
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

  // 🔒 DECISION-0189B D2 (estendida em 2026-08-01) — os readers de batch recebem a MESMA contenção
  // que `/orders` já tinha. Não é decisão nova: é o mesmo veredito aplicado aos irmãos que ficaram
  // fora das DUAS ondas (0128 conteve os writers com 403; 0189B D2 conteve `/orders` com 503).
  // DEFEITO REAL, medido: `payout_batches` e `payout_orders` NÃO EXISTEM no schema canônico, então
  // `listBatches`/`getBatchById`/`getOrderById` devolviam **42P01** — erro de banco cru, num
  // caminho de dinheiro, autenticado. Não era 200 vazio nem 404.
  // FORMA: 503 uniforme e SEM preHandler, de propósito — 403 para quem não tem a chave e 503 para
  // quem tem vaza quem a detém. "Idêntica com e sem actorId" é o texto da própria 0189B.
  // ⛔ NÃO religue ao substrato: a leitura governada é frente PRÓPRIA da abertura da PORTA 01
  // (PermissionKey de leitura + filtro por actor/empresa + recurso server-side + audit + no-store).
  // Materializar a tabela para fazer estes handlers rodarem é forward-only e cria a segunda casa.
  fastify.get('/payouts/batches', async (_req, reply) => {
    return reply.status(503).send({ code: 'PORTA_01_CLOSED' });
  });

  fastify.get<{ Params: { batchId: string } }>('/payouts/batches/:batchId', async (_req, reply) => {
    return reply.status(503).send({ code: 'PORTA_01_CLOSED' });
  });

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
    // 🔒 DECISION-0189B D2 — mesma contenção do `GET /payouts/orders` e dos readers de batch.
    // `getOrderById` lia `payout_orders`, tabela AUSENTE → 42P01 em caminho de dinheiro.
    // 503 UNIFORME, sem preHandler (o 403/503 diferenciado vazaria quem tem a permissão).
    async (_req, reply) => {
      return reply.status(503).send({ code: 'PORTA_01_CLOSED' });
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
