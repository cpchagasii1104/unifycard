import type { FastifyInstance } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
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