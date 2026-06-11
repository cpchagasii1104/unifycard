// backend/src/modules/marketplace/routes/marketplace-inventory.routes.ts
// PASSO 4 do trilho Codex (Prova A Supply Chain) — Nível A.
// Mínimo HTTP: 3 GETs read-only consumindo services existentes (zero side-effects).
// Substrato é actor-aware (cf. PASSO 2 auditoria); read model continua tenant-wide.

import type { FastifyInstance } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { authorizationService } from '@core/authorization/authorization.service';
import { inventoryService } from '../inventory.service';
import { marketplaceLogger } from '../marketplace.logger';
import { AppError, BadRequestError, UnauthorizedError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import type {
  InventoryMovementType,
  ListInventoryMovementsOptions,
} from '../inventory.types';

const ALLOWED_MOVEMENT_TYPES: ReadonlySet<InventoryMovementType> = new Set([
  'IN',
  'OUT',
  'ADJUSTMENT',
]);

export async function registerMarketplaceInventoryRoutes(
  app: FastifyInstance,
  _svc?: unknown
): Promise<void> {
  /**
   * GET /marketplace/inventory/balance?variantId=X — TOMBSTONE 501.
   *
   * F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL (DEC-A): o saldo
   * tenant-wide (calculateBalance somando TODOS os actors do tenant) é leak de
   * recurso privado no tenant compartilhado (DECISION-0116 ACTOR_PRIVATE). A rota
   * é DESATIVADA fail-closed: NÃO chama service, NÃO toca inventory_movements,
   * NÃO cria estado. Auth + tenant preservados pela scope. Os consumidores devem
   * usar os contratos ESCOPADOS já existentes: saldo por actor
   * (`/inventory/balance/by-actor`, canRepresentActor) ou saldo consolidado
   * empresarial autorizado (`/inventory/company/:companyId/balance`,
   * canViewConsolidatedInventory). A rota NÃO é reaproveitada com companyId/actorId
   * — os contratos escopados têm rotas próprias.
   */
  app.get<{ Querystring: { variantId?: string } }>(
    '/inventory/balance',
    async (req, reply) => {
      if (!req.tenant) throw new UnauthorizedError('Tenant required');
      return reply.status(501).send({
        ok: false,
        error: 'INVENTORY_TENANT_WIDE_BALANCE_DISABLED',
        code: 'INVENTORY_TENANT_WIDE_BALANCE_DISABLED',
        message:
          'Saldo de estoque tenant-wide foi desativado (DECISION-0116). Use o saldo por ' +
          'actor (GET /marketplace/inventory/balance/by-actor) ou o saldo consolidado ' +
          'empresarial autorizado (GET /marketplace/inventory/company/:companyId/balance).',
      });
    }
  );

  /**
   * GET /marketplace/inventory/balance/by-actor?actorId=Y&variantId=X
   * Saldo operacional por actor (drill-down: quanto a unidade Y tem da variante X).
   * Consome inventoryService.getCurrentBalanceByActor (criado em PASSO 3 do trilho).
   */
  app.get<{ Querystring: { actorId?: string; variantId?: string } }>(
    '/inventory/balance/by-actor',
    { preHandler: requirePermission('marketplace_manage_inventory') },
    async (req, reply) => {
      if (!req.tenant) throw new UnauthorizedError('Tenant required');
      const { actorId, variantId } = req.query;
      if (!actorId?.trim()) {
        throw new BadRequestError('actorId é obrigatório', ErrorCode.BAD_REQUEST);
      }
      if (!variantId?.trim()) {
        throw new BadRequestError('variantId é obrigatório', ErrorCode.BAD_REQUEST);
      }

      // 🔴 DECISION-0113: `can_manage_marketplace` é DEFAULT de TODA company (actor-registry) — NÃO prova
      // autoridade sobre o `actorId` filtrado. `query.actorId` é HINT → exigir representar o actor alvo ANTES
      // de ler o estoque dele (senão company A lê o estoque da company B). 401 sem user; 403 fail-closed.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }
      let canRep = false;
      try {
        canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId);
      } catch {
        canRep = false;
      }
      if (!canRep) {
        return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'INVENTORY_ACTOR_NOT_REPRESENTABLE' });
      }

      try {
        const balance = await inventoryService.getCurrentBalanceByActor(
          req.tenant.id,
          actorId,
          variantId
        );
        return reply.status(200).send(balance);
      } catch (error: unknown) {
        marketplaceLogger.error('Erro ao buscar saldo por actor', error as Error);
        if (error instanceof AppError) throw error;
        throw new BadRequestError(
          error instanceof Error ? error.message : 'Erro ao buscar saldo por actor',
          ErrorCode.BAD_REQUEST
        );
      }
    }
  );

  /**
   * GET /marketplace/inventory/movements?variantId=X[&actorId=&movementType=&referenceType=&referenceId=&startDate=&endDate=&limit=&offset=]
   * Extrato de movimentações de uma variante (auditoria / fonte da verdade).
   * Consome inventoryService.getMovements; filtros mapeiam ListInventoryMovementsOptions.
   */
  app.get<{
    Querystring: {
      variantId?: string;
      actorId?: string;
      movementType?: string;
      referenceType?: string;
      referenceId?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };
  }>(
    '/inventory/movements',
    { preHandler: requirePermission('marketplace_manage_inventory') },
    async (req, reply) => {
      if (!req.tenant) throw new UnauthorizedError('Tenant required');
      const {
        variantId,
        actorId,
        movementType,
        referenceType,
        referenceId,
        startDate,
        endDate,
        limit,
        offset,
      } = req.query;
      if (!variantId?.trim()) {
        throw new BadRequestError('variantId é obrigatório', ErrorCode.BAD_REQUEST);
      }

      // F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL (DEC-A): `actorId` é
      // OBRIGATÓRIO. O extrato é ACTOR_PRIVATE (DECISION-0116; expõe actor_id +
      // created_by_user_id por linha). SEM actorId, a query era tenant-wide itemizada
      // (leak cross-company). Agora: ausente → 400; presente → UUID + canRepresentActor
      // ANTES do service. `can_manage_marketplace` (default de toda company) NÃO autoriza
      // ver o extrato de actor alheio. SEM fallback (actionContext/companyId/actor ativo/
      // LIMIT 1/tenant inteiro). 401 sem user; 403 fail-closed.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!actorId?.trim()) {
        return reply.status(400).send({
          error: 'actorId é obrigatório (extrato de movimentos é por actor — ACTOR_PRIVATE)',
          code: 'INVENTORY_ACTOR_ID_REQUIRED',
        });
      }
      if (!UUID_RE.test(actorId)) {
        return reply.status(400).send({ error: 'actorId inválido (UUID)', code: 'INVENTORY_ACTOR_ID_REQUIRED' });
      }
      {
        const userId = (req as { user?: { userId?: string } }).user?.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
        }
        let canRep = false;
        try {
          canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, actorId);
        } catch {
          canRep = false;
        }
        if (!canRep) {
          return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'INVENTORY_ACTOR_NOT_REPRESENTABLE' });
        }
      }

      const options: ListInventoryMovementsOptions = {};

      if (movementType?.trim()) {
        if (!ALLOWED_MOVEMENT_TYPES.has(movementType as InventoryMovementType)) {
          throw new BadRequestError(
            `movementType inválido. Permitidos: ${[...ALLOWED_MOVEMENT_TYPES].join(', ')}`,
            ErrorCode.BAD_REQUEST
          );
        }
        options.movementType = movementType as InventoryMovementType;
      }
      if (actorId?.trim()) options.actorId = actorId;
      if (referenceType?.trim()) options.referenceType = referenceType;
      if (referenceId?.trim()) options.referenceId = referenceId;
      if (startDate) {
        const d = new Date(startDate);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestError('startDate inválida (ISO 8601)', ErrorCode.BAD_REQUEST);
        }
        options.startDate = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestError('endDate inválida (ISO 8601)', ErrorCode.BAD_REQUEST);
        }
        options.endDate = d;
      }
      if (limit) {
        const n = parseInt(limit, 10);
        if (!Number.isFinite(n) || n < 1) {
          throw new BadRequestError('limit deve ser inteiro positivo', ErrorCode.BAD_REQUEST);
        }
        options.limit = n;
      }
      if (offset) {
        const n = parseInt(offset, 10);
        if (!Number.isFinite(n) || n < 0) {
          throw new BadRequestError('offset deve ser inteiro >= 0', ErrorCode.BAD_REQUEST);
        }
        options.offset = n;
      }

      try {
        const movements = await inventoryService.getMovements(req.tenant.id, variantId, options);
        return reply.status(200).send({ movements });
      } catch (error: unknown) {
        marketplaceLogger.error('Erro ao listar movimentações', error as Error);
        if (error instanceof AppError) throw error;
        throw new BadRequestError(
          error instanceof Error ? error.message : 'Erro ao listar movimentações',
          ErrorCode.BAD_REQUEST
        );
      }
    }
  );

  /**
   * GET /marketplace/inventory/company/:companyId/balance?variantId=X
   * Saldo CONSOLIDADO da empresa (DECISION-0116 adendo — projeção COMPANY_INTERNAL).
   *
   * Gate server-side: canViewConsolidatedInventory (vínculo ATIVO em company_users com
   * can_manage_company OU can_view_consolidated_inventory). `can_manage_marketplace`
   * NÃO autoriza (capability default de toda company). Mesmo tenant NÃO autoriza.
   * Actors resolvidos server-side por actors.company_id = :companyId — o cliente NUNCA
   * fornece actorIds (presença de actorId/actorIds na query → 400 explícito).
   * Empresa sem actors → zero explícito, sem fallback tenant-wide. GET não cria actor.
   */
  app.get<{
    Params: { companyId: string };
    Querystring: { variantId?: string; actorId?: string; actorIds?: string };
  }>(
    '/inventory/company/:companyId/balance',
    async (req, reply) => {
      if (!req.tenant) throw new UnauthorizedError('Tenant required');
      const userId = (req as { user?: { userId?: string; globalUserId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }

      const { companyId } = req.params;
      const { variantId, actorId, actorIds } = req.query;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!companyId || !UUID_RE.test(companyId)) {
        throw new BadRequestError('companyId inválido (UUID)', ErrorCode.BAD_REQUEST);
      }
      if (!variantId?.trim()) {
        throw new BadRequestError('variantId é obrigatório', ErrorCode.BAD_REQUEST);
      }
      // O conjunto de actors do consolidado é resolvido EXCLUSIVAMENTE server-side.
      if (actorId !== undefined || actorIds !== undefined) {
        throw new BadRequestError(
          'actorId/actorIds não são aceitos no consolidado empresarial — o conjunto é resolvido server-side',
          ErrorCode.BAD_REQUEST
        );
      }

      // Identidade humana do caller: globalUserId do token quando presente, senão resolvido
      // server-side (fail-closed) — mesmo padrão do binding de DECISION-0113.
      let globalUserId = (req as { user?: { globalUserId?: string } }).user?.globalUserId ?? null;
      if (!globalUserId) {
        try {
          const { resolveGlobalUserId } = await import('@core/identity/identity.utils');
          globalUserId = await resolveGlobalUserId(userId, req.tenant.id);
        } catch {
          globalUserId = null;
        }
      }
      if (!globalUserId) {
        return reply.status(403).send({
          error: 'Identidade global do caller não resolvida',
          code: 'CONSOLIDATED_INVENTORY_FORBIDDEN',
        });
      }

      const { companiesService } = await import('@core/companies/companies.service');
      let canView = false;
      try {
        canView = await companiesService.canViewConsolidatedInventory(req.tenant.id, companyId, globalUserId);
      } catch {
        canView = false;
      }
      if (!canView) {
        return reply.status(403).send({
          error: 'Sem autoridade para a projeção consolidada desta empresa',
          code: 'CONSOLIDATED_INVENTORY_FORBIDDEN',
        });
      }

      try {
        const balance = await inventoryService.getCompanyConsolidatedBalance(
          req.tenant.id,
          companyId,
          variantId
        );
        return reply.status(200).send({
          companyId,
          productVariantId: variantId,
          consolidatedQuantity: balance.quantity,
          unit: balance.unit,
          actorCount: balance.actorCount,
          resolvedAt: new Date().toISOString(),
        });
      } catch (error: unknown) {
        marketplaceLogger.error('Erro ao buscar saldo consolidado da empresa', error as Error);
        if (error instanceof AppError) throw error;
        throw new BadRequestError(
          error instanceof Error ? error.message : 'Erro ao buscar saldo consolidado',
          ErrorCode.BAD_REQUEST
        );
      }
    }
  );
}
