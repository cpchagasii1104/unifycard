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
import { NotFoundError } from '@core/errors';

// 🔴 CONTENÇÃO Z2-R4 — F-AUTHORITY-Z2-R4-MONEY-LATENT-CONTAINMENT (fail-closed).
// Rotas money-latent: o sink (settlementService.settle / regionAccountService.credit|debit) está
// morto por Proxy ("migrated to Bank") e a rota lia `actionContext.actorId` CRU, sem authority
// binding (DECISION-0113/0131 §B7: actorId declarado pelo cliente nunca é autoridade). Para tornar
// a contenção EXPLÍCITA e auditável (não dependente do stub), os handlers de MUTAÇÃO foram
// REDUZIDOS a um 403 fail-closed: NÃO há caminho (alcançável ou morto) que chame
// settlementService.settle / regionAccountService.credit|debit. Motor financeiro intacto, porém
// INALCANÇÁVEL. Readers GET permanecem vivos. Reabilitação SÓ com frente própria: decisão de
// authority + binding server-side (canRepresentActor/requirePermission) + fluxo Bank canônico +
// E2E financeiro + reseal Yala. Ver DT-AUTHORITY-Z2-MARKETPLACE-MONEY-LATENT-ACTORID-UNBOUND
// (vinculada a DT-MONEY-LATENT-REACTIVATION-TRAP).
const SETTLEMENT_HTTP_EXECUTION_DISABLED = {
  ok: false,
  code: 'SETTLEMENT_HTTP_EXECUTION_DISABLED',
  message:
    'Settlement execution through HTTP is contained until Bank migration provides authority binding (DECISION-0113/0131). Reactivation requires a dedicated frente: authority decision, server-side binding (canRepresentActor/requirePermission), canonical Bank flow, financial E2E and Yala reseal.',
} as const;
const REGION_ACCOUNT_HTTP_EXECUTION_DISABLED = {
  ok: false,
  code: 'REGION_ACCOUNT_HTTP_EXECUTION_DISABLED',
  message:
    'Region account credit/debit through HTTP is contained until Bank migration provides authority binding (DECISION-0113/0131). Reactivation requires a dedicated frente: authority decision, server-side binding (canRepresentActor/requirePermission), canonical Bank flow, financial E2E and Yala reseal.',
} as const;

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
  fastify.post<{ Params: { id: string } }>('/settlements/:id/settle', async (_req, reply) => {
    // 🔴 CONTENÇÃO Z2-R4 (fail-closed): NÃO chama settlementService.settle. Ver banner acima.
    return reply.status(403).send(SETTLEMENT_HTTP_EXECUTION_DISABLED);
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
  }>('/regions/:id/account/credit', async (_req, reply) => {
    // 🔴 CONTENÇÃO Z2-R4 (fail-closed): NÃO chama regionAccountService.credit. Ver banner acima.
    return reply.status(403).send(REGION_ACCOUNT_HTTP_EXECUTION_DISABLED);
  });

  /**
   * POST /regions/:id/account/debit
   * Debita valor da conta regional
   */
  fastify.post<{
    Params: { id: string };
    Body: DebitRegionAccountInput;
  }>('/regions/:id/account/debit', async (_req, reply) => {
    // 🔴 CONTENÇÃO Z2-R4 (fail-closed): NÃO chama regionAccountService.debit. Ver banner acima.
    return reply.status(403).send(REGION_ACCOUNT_HTTP_EXECUTION_DISABLED);
  });
};

export default settlementRoutes;