// backend/src/modules/marketplace/settlement.routes.ts
// SPRINT 77: Rotas REST para Settlements e Region Accounts

import type { FastifyInstance } from 'fastify';
import { settlementService } from './settlement.service';
import type {
  SettlementFilters,
  CreditRegionAccountInput,
  DebitRegionAccountInput,
} from './settlement.types';
import { regionAccountService } from './region-account.service';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const settlementRoutes = async (fastify: FastifyInstance) => {
  // ============================================================
  // SETTLEMENTS
  // ============================================================

  /**
   * GET /settlements
   * Lista settlements
   */
  fastify.get<{
    Querystring: {
      regionId?: string;
      sourceType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/settlements', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const filters: SettlementFilters = {};
    if (req.query.regionId) {
      filters.regionId = req.query.regionId;
    }
    if (req.query.sourceType) {
      filters.sourceType = req.query.sourceType as any;
    }
    if (req.query.status) {
      filters.status = req.query.status as any;
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    const settlements = await settlementService.listSettlements(tenantId, filters);

    return reply.send({ settlements, totalCents: settlements.length });
  });

  /**
   * GET /settlements/:id
   * Busca settlement por ID
   */
  fastify.get<{ Params: { id: string } }>('/settlements/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const settlement = await settlementService.getSettlementById(tenantId, req.params.id);

    if (!settlement) {
      throw new NotFoundError('Settlement não encontrado');
    }

    return reply.send(settlement);
  });

  /**
   * POST /settlements/:id/settle
   * Liquida settlement (credita RegionAccount)
   */
  fastify.post<{ Params: { id: string } }>('/settlements/:id/settle', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const settlement = await settlementService.settle(
      tenantId,
      req.params.id,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.send(settlement);
  });

  // ============================================================
  // REGION ACCOUNTS
  // ============================================================

  /**
   * GET /regions/:id/account
   * Busca conta regional
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { currency?: string };
  }>('/regions/:id/account', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const currency = req.query.currency || 'BRL';

    const account = await regionAccountService.getAccount(
      tenantId,
      req.params.id,
      currency
    );

    return reply.send(account);
  });

  /**
   * POST /regions/:id/account/credit
   * Credita valor na conta regional
   */
  fastify.post<{
    Params: { id: string };
    Body: CreditRegionAccountInput;
  }>('/regions/:id/account/credit', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const account = await regionAccountService.credit(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.send(account);
  });

  /**
   * POST /regions/:id/account/debit
   * Debita valor da conta regional
   */
  fastify.post<{
    Params: { id: string };
    Body: DebitRegionAccountInput;
  }>('/regions/:id/account/debit', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const account = await regionAccountService.debit(
      tenantId,
      req.params.id,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.send(account);
  });
};

export default settlementRoutes;