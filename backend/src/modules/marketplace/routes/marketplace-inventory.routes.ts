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
   * GET /marketplace/inventory/balance?variantId=X
   * Saldo consolidado por variante (visão matriz tenant-wide).
   * Soma todos actors do tenant — alinhado a inventoryService.getCurrentBalance.
   */
  app.get<{ Querystring: { variantId?: string } }>(
    '/inventory/balance',
    { preHandler: requirePermission('marketplace_manage_inventory') },
    async (req, reply) => {
      if (!req.tenant) throw new UnauthorizedError('Tenant required');
      const { variantId } = req.query;
      if (!variantId?.trim()) {
        throw new BadRequestError('variantId é obrigatório', ErrorCode.BAD_REQUEST);
      }
      try {
        const balance = await inventoryService.getCurrentBalance(req.tenant.id, variantId);
        return reply.status(200).send(balance);
      } catch (error: unknown) {
        marketplaceLogger.error('Erro ao buscar saldo de estoque', error as Error);
        if (error instanceof AppError) throw error;
        throw new BadRequestError(
          error instanceof Error ? error.message : 'Erro ao buscar saldo',
          ErrorCode.BAD_REQUEST
        );
      }
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

      // 🔴 DECISION-0113: quando filtra por `actorId`, exigir representá-lo (`can_manage_marketplace` é default
      // de toda company → não autoriza ver o extrato de actor alheio). 401 sem user; 403 fail-closed. SEM
      // `actorId`: comportamento atual preservado (extrato tenant-wide da variante = broad read, fora desta fatia).
      if (actorId?.trim()) {
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
}
