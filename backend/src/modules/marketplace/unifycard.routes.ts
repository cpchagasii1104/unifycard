// backend/src/modules/marketplace/unifycard.routes.ts
// SPRINT 73: Rotas REST para UnifyCard Acquiring

import type { FastifyInstance } from 'fastify';
import { unifyCardService } from './unifycard.service';
import type {
  AuthorizeTransactionInput,
  CaptureTransactionInput,
  SettleTransactionInput,
  UnifyCardTransactionFilters,
} from './unifycard.types';
import { NotFoundError } from '@core/errors';

// 🔴 CONTENÇÃO Z2-R4 — F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT (fail-closed).
// Rotas money-latent: o sink (unifyCardService.authorize|capture|settle) está morto por Proxy
// ("UnifyCard migrated to Bank") e a rota usava `actionContext.actorId` CRU como autoria/autoridade,
// sem binding server-side (DECISION-0113/0131 §B7). Para tornar a contenção EXPLÍCITA e auditável
// (não dependente do stub), os handlers de MUTAÇÃO foram REDUZIDOS a um 403 fail-closed: NÃO há
// caminho (alcançável ou morto) que chame unifyCardService.authorize|capture|settle. Motor
// financeiro intacto, porém INALCANÇÁVEL. Readers GET permanecem vivos. Reabilitação SÓ com frente
// própria: decisão de authority + binding server-side (canRepresentActor/requirePermission) + fluxo
// Bank canônico + E2E financeiro + reseal Yala. Ver
// DT-AUTHORITY-Z2-MARKETPLACE-MONEY-LATENT-ACTORID-UNBOUND (vinculada a DT-MONEY-LATENT-REACTIVATION-TRAP).
const UNIFYCARD_HTTP_EXECUTION_DISABLED = {
  ok: false,
  code: 'UNIFYCARD_HTTP_EXECUTION_DISABLED',
  message:
    'UnifyCard authorize/capture/settle through HTTP is contained until Bank migration provides authority binding (DECISION-0113/0131). Reactivation requires a dedicated frente: authority decision, server-side binding (canRepresentActor/requirePermission), canonical Bank flow, financial E2E and Yala reseal.',
} as const;

const unifyCardRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /unifycard/authorize
   * Autoriza transação UnifyCard
   */
  fastify.post<{ Body: AuthorizeTransactionInput }>('/unifycard/authorize', async (_req, reply) => {
    // 🔴 CONTENÇÃO Z2-R4 (fail-closed): NÃO chama unifyCardService.authorize. Ver banner acima.
    return reply.status(403).send(UNIFYCARD_HTTP_EXECUTION_DISABLED);
  });

  /**
   * POST /unifycard/capture
   * Captura transação UnifyCard
   */
  fastify.post<{ Body: CaptureTransactionInput }>('/unifycard/capture', async (_req, reply) => {
    // 🔴 CONTENÇÃO Z2-R4 (fail-closed): NÃO chama unifyCardService.capture. Ver banner acima.
    return reply.status(403).send(UNIFYCARD_HTTP_EXECUTION_DISABLED);
  });

  /**
   * POST /unifycard/settle
   * Liquida transação UnifyCard
   */
  fastify.post<{ Body: SettleTransactionInput }>('/unifycard/settle', async (_req, reply) => {
    // 🔴 CONTENÇÃO Z2-R4 (fail-closed): NÃO chama unifyCardService.settle. Ver banner acima.
    return reply.status(403).send(UNIFYCARD_HTTP_EXECUTION_DISABLED);
  });

  /**
   * GET /unifycard/transactions
   * Lista transações UnifyCard
   */
  fastify.get('/unifycard/transactions', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: UnifyCardTransactionFilters = {};
    if (query.actorId) filters.actorId = query.actorId;
    if (query.status) filters.status = query.status as any;
    if (query.transactionType) filters.transactionType = query.transactionType as any;
    if (query.paymentIntentId) filters.paymentIntentId = query.paymentIntentId;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const transactions = await unifyCardService.listTransactions(tenantId, filters);
    return { transactions };
  });

  /**
   * GET /unifycard/transactions/:id
   * Busca transação por ID
   */
  fastify.get<{ Params: { id: string } }>('/unifycard/transactions/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const transaction = await unifyCardService.getTransactionById(tenantId, id);
    if (!transaction) {
      throw new NotFoundError('Transação não encontrada');
    }

    return transaction;
  });
};

export default unifyCardRoutes;
