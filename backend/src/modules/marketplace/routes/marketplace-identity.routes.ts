import type { FastifyInstance } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { authorizationService } from '@core/authorization/authorization.service';
import { economicIdentityService } from '../economic-identity.service';
import { trustEngineService } from '../../trust/trust-engine.service';
import { marketplaceLogger } from '../marketplace.logger';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, InternalServerError, ConflictError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

export async function registerIdentityRoutes(fastify: FastifyInstance) {
  // ============================================================
  // TRUST LAYER E IDENTIDADE ECONÔMICA
  // ============================================================

  // POST /marketplace/economic-identities (FASE X — backing real)
  fastify.post<{
    Body: {
      actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
      actor_id: string;
      verified_assets?: {
        documents_verified?: boolean;
        bank_account_verified?: boolean;
        company_verified?: boolean;
      };
    };
  }>('/economic-identities', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant required');
    }
    const tenantId = req.tenant.id;

    // 🔴 DECISION-0113 (A-write body-driven): o actor alvo vem de `body.actor_id`. `can_manage_marketplace`
    // (default de TODA company) não autoriza criar a identidade econômica de actor alheio. `body.actor_id` é
    // HINT → exigir representá-lo ANTES de createEconomicIdentity (senão company A cria economic identity de B).
    const targetActorId = req.body.actor_id;
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, userId, targetActorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'MARKETPLACE_ACTOR_NOT_REPRESENTABLE' });
    }

    try {
      const identity = await economicIdentityService.createEconomicIdentity(tenantId, {
        actorId: req.body.actor_id,
        actorType: req.body.actor_type,
        verified_assets: req.body.verified_assets,
      });
      marketplaceLogger.api('Economic identity criada', { identity_id: identity.economicIdentityId });
      return reply.status(201).send(identity);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao criar economic identity', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao criar identidade econômica',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/economic-identities/:actorId (FASE X — backing real)
  fastify.get<{ Params: { actorId: string } }>('/economic-identities/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant required');
    }
    const tenantId = req.tenant.id;
    const { actorId } = req.params;

    // 🔴 DECISION-0113: `marketplace_manage_catalog` → `can_manage_marketplace`, que é DEFAULT de TODA company
    // (actor-registry getDefaultCapabilities). O guard prova que o caller representa o PRÓPRIO actor e tem a
    // capability — NÃO prova autoridade sobre o `params.actorId` alvo. `:actorId` é HINT → exigir representar o
    // actor alvo ANTES de ler a identidade econômica dele (senão company A lê a economic identity da company B).
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, userId, actorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'MARKETPLACE_ACTOR_NOT_REPRESENTABLE' });
    }

    try {
      const identity = await economicIdentityService.getEconomicIdentity(tenantId, actorId);
      if (!identity) {
        throw new NotFoundError('Identidade econômica não encontrada');
      }
      return reply.status(200).send(identity);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar economic identity', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar identidade econômica',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // POST /marketplace/economic-identities/:actorId/recalculate (FASE X — backing real)
  fastify.post<{ Params: { actorId: string } }>('/economic-identities/:actorId/recalculate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant required');
    }
    const tenantId = req.tenant.id;
    const { actorId } = req.params;

    // 🔴 DECISION-0113 (A-write): recalculate é write actor-keyed. `can_manage_marketplace` é default de toda
    // company → não autoriza recalcular a identidade econômica de actor alheio. `:actorId` é HINT → exigir
    // representá-lo ANTES de qualquer recalculate (senão company A dispara recálculo da identidade de B).
    const userId = (req as { user?: { userId?: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
    }
    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, userId, actorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'MARKETPLACE_ACTOR_NOT_REPRESENTABLE' });
    }

    try {
      const identity = await economicIdentityService.recalculateTrustScore(tenantId, actorId);
      if (!identity) {
        throw new NotFoundError('Identidade econômica não encontrada');
      }
      marketplaceLogger.api('Trust level recalculado', { actor_id: actorId });
      return reply.status(200).send(identity);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao recalcular trust level', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao recalcular trust level',
        ErrorCode.BAD_REQUEST
      );
    }
  });

  // GET /marketplace/trust-events/:actorId
  fastify.get<{ Params: { actorId: string } }>('/trust-events/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        throw new UnauthorizedError('Tenant required');
      }
      const tenantId = req.tenant.id;
      const { actorId } = req.params;

      // 🔴 DECISION-0113: mesma raiz — `can_manage_marketplace` é default de company → não autoriza ver os
      // trust events de actor alheio. `:actorId` é HINT → exigir representá-lo ANTES de `listTrustEvents`.
      const userId = (req as { user?: { userId?: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.userId)' });
      }
      let canRep = false;
      try {
        canRep = await authorizationService.canRepresentActor(tenantId, userId, actorId);
      } catch {
        canRep = false;
      }
      if (!canRep) {
        return reply.status(403).send({ error: 'Sem autoridade sobre o actor (canRepresentActor)', code: 'MARKETPLACE_ACTOR_NOT_REPRESENTABLE' });
      }

      const events = await trustEngineService.listTrustEvents(tenantId, { actorId });
      return reply.status(200).send({ events });
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar trust events', error as Error);
      if (error instanceof AppError) throw error;
      throw new BadRequestError(
        error instanceof Error ? error.message : 'Erro ao buscar eventos de trust',
        ErrorCode.BAD_REQUEST
      );
    }
  });
}