// backend/src/modules/marketplace/store-onboarding.routes.ts
// Rotas para Store Onboarding
// 🔴 BLINDAGEM: Loja apenas seleciona recortes, não cria categorias

import type { FastifyInstance, FastifyError } from 'fastify';
import { z } from 'zod';
import { storeOnboardingService } from './store-onboarding.service';
import { listVisibleProducts } from './product-visibility.service';
import type { StoreOnboardingInput } from './store-onboarding.types';
import type { BusinessAction } from '@core/authorization/business-permissions.types';
import { businessAuthorizationService } from '@core/authorization/business-authorization.service';
import { AppError, BadRequestError, UnauthorizedError, ForbiddenError, InternalServerError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import type { ActorRow } from '@modules/social/actor.repository';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import type { StoreOnboardingLogContext } from '@core/observability/marketplace-store-onboarding.observability';

declare module 'fastify' {
  interface FastifyRequest {
    /** PK `actors.id` do utilizador autenticado (FK em `actor_category_imports.imported_by_actor_id`). */
    marketplaceStoreOnboardingImporterActorId?: string;
  }
}

const storeOnboardingRoutes = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (req, reply) => {
    const requestId = String((req as { requestId?: string }).requestId ?? 'unknown');
    reply.header('x-request-id', requestId);
  });

  fastify.setErrorHandler((error: FastifyError, req, reply) => {
    const requestId = String((req as { requestId?: string }).requestId ?? 'unknown');
    reply.header('x-request-id', requestId);

    const tenantId = (req as { tenant?: { id?: string } }).tenant?.id ?? null;
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as { actorId?: string })
        : {};
    const actorId =
      (typeof body.actorId === 'string' ? body.actorId : null) ??
      (req as { actionContext?: { actorId?: string } }).actionContext?.actorId ??
      null;
    const importerActorId =
      (req as { marketplaceStoreOnboardingImporterActorId?: string }).marketplaceStoreOnboardingImporterActorId ??
      null;

    const errStructured: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    if (error instanceof AppError) {
      errStructured.code = error.code;
      errStructured.statusCode = error.statusCode;
    } else if (typeof error.statusCode === 'number') {
      errStructured.statusCode = error.statusCode;
    }

    req.log.error(
      {
        event: 'store_onboarding_error',
        requestId,
        tenantId,
        actorId,
        importerActorId,
        err: errStructured,
        path: req.url,
        method: req.method,
      },
      'store_onboarding_error'
    );

    if (reply.sent) {
      return;
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    const isProduction = process.env.NODE_ENV === 'production';
    const message =
      error instanceof AppError
        ? error.getSafeMessage()
        : statusCode >= 500 && isProduction
          ? 'Internal server error'
          : error.message;

    return reply.status(statusCode).send({
      error: message,
      requestId,
      ...(error instanceof AppError ? { code: error.code } : {}),
    });
  });

  /**
   * Middleware: Verificar permissão para acessar Store Onboarding
   */
  const requireStorePermission = async (req: any, reply: any, action: BusinessAction) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Não autenticado');
    }

    try {
      const actor = await ensureUserActor(tenantId, userId);
      if (!actor) {
        throw new ForbiddenError('Actor não encontrado');
      }

      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        action,
        'store_onboarding'
      );

      const actorRow = actor as ActorRow & { id: string };
      req.marketplaceStoreOnboardingImporterActorId = actorRow.id;
    } catch (permError: any) {
      throw new ForbiddenError('Sem permissão para acessar Store Onboarding');
    }
  };

  /**
   * POST /marketplace/store-onboarding
   * Cria onboarding de loja
   */
  fastify.post<{
    Body: {
      actorId: string;
      /** PONTE Estágio 4: empresa PJ classificada — deriva company_type de companies.primary_company_type_id. */
      companyId?: string;
      /** Opcional: herdado de `company_types.default_*_slugs` quando omitido (StoreOnboardingInput). */
      departmentCategoryId?: string;
      selectedCategoryIds?: string[];
      hasOwnProducts: boolean;
      defaultCostPrice?: number;
      defaultSalePrice?: number;
      defaultStock?: number;
      metadata?: Record<string, any>;
    };
  }>(
    '/marketplace/store-onboarding',
    {
      // §5.1 PLANO_FASE_ATUAL: autoridade de criação/reuso de canonical no onboarding — ver
      // docs/01_normative/ADR_CANONICAL_CREATE_AUTHORITY.md
      preHandler: async (req, reply) => {
        await requireStorePermission(req, reply, 'MARKETPLACE_STORE_CREATE');
      },
    },
    async (req, reply) => {
      const bodySchema = z.object({
        actorId: z.string().uuid(),
        companyId: z.string().uuid().optional(),
        departmentCategoryId: z.string().uuid().optional(),
        selectedCategoryIds: z.array(z.string().uuid()).optional(),
        hasOwnProducts: z.boolean(),
        defaultCostPrice: z.number().optional(),
        defaultSalePrice: z.number().optional(),
        defaultStock: z.number().int().min(0).optional(),
        metadata: z.record(z.any()).optional(),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(400, 'Dados inválidos', ErrorCode.VALIDATION_ERROR, {
          zodErrors: validationResult.error.errors,
        });
      }
      if (!req.tenant?.id) {
        throw new BadRequestError('Tenant é obrigatório', ErrorCode.VALIDATION_ERROR);
      }
      const tenantId = req.tenant.id;
      const importerActorId = req.marketplaceStoreOnboardingImporterActorId;
      if (!importerActorId) {
        throw new InternalServerError(
          'Invariant: marketplaceStoreOnboardingImporterActorId ausente após autorização'
        );
      }

      try {
        const data = validationResult.data;
        const input: StoreOnboardingInput = {
          // C51 fix: usar importerActorId (actor_id real) como fallback, não userId
          actorId: data.actorId ?? importerActorId,
          hasOwnProducts: data.hasOwnProducts,
          defaultCostPrice: data.defaultCostPrice,
          defaultSalePrice: data.defaultSalePrice,
          defaultStock: data.defaultStock,
          metadata: data.metadata,
        };
        if (data.companyId !== undefined) {
          input.companyId = data.companyId;
        }
        if (data.departmentCategoryId !== undefined) {
          input.departmentCategoryId = data.departmentCategoryId;
        }
        if (data.selectedCategoryIds !== undefined) {
          input.selectedCategoryIds = data.selectedCategoryIds;
        }

        const requestId = String((req as { requestId?: string }).requestId ?? 'unknown');
        const storeActorId = input.actorId;
        const logContext: StoreOnboardingLogContext = {
          logger: req.log.child({
            requestId,
            tenantId,
            actorId: storeActorId,
            importerActorId,
          }),
          requestId,
          tenantId,
          actorId: storeActorId,
          importerActorId,
        };

        const result = await storeOnboardingService.createStoreOnboarding(
          tenantId,
          input,
          importerActorId,
          req.user?.id, // userId para auditoria (opcional)
          logContext
        );

        return reply.send({ result });
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw new BadRequestError(
          err instanceof Error ? err.message : 'Erro ao criar onboarding de loja',
          ErrorCode.BAD_REQUEST
        );
      }
    }
  );

  /**
   * GET /marketplace/store-onboarding/available-products
   * Lista produtos do catálogo disponíveis para importação
   */
  fastify.get<{
    Querystring: {
      categoryIds: string; // Comma-separated
    };
  }>  (
    '/marketplace/store-onboarding/available-products',
    {
      preHandler: async (req, reply) => {
        await requireStorePermission(req, reply, 'MARKETPLACE_STORE_VIEW');
      },
    },
    async (req, reply) => {
      if (!req.tenant?.id) {
        throw new BadRequestError('Tenant é obrigatório', ErrorCode.VALIDATION_ERROR);
      }
      const tenantId = req.tenant.id;
      const categoryIds = typeof req.query.categoryIds === 'string'
        ? req.query.categoryIds.split(',').filter(Boolean)
        : [];

      try {
        const products = await storeOnboardingService.listAvailableCatalogProducts(
          tenantId,
          categoryIds
        );

        return reply.send({ products });
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw new InternalServerError('Erro ao listar produtos disponíveis');
      }
    }
  );

  /**
   * GET /marketplace/store-onboarding/category-stats
   * Retorna estatísticas de produtos disponíveis por categoria
   */
  fastify.get<{
    Querystring: {
      categoryIds: string; // Comma-separated
    };
  }>(
    '/marketplace/store-onboarding/category-stats',
    {
      preHandler: async (req, reply) => {
        await requireStorePermission(req, reply, 'MARKETPLACE_STORE_VIEW');
      },
    },
    async (req, reply) => {
      if (!req.tenant?.id) {
        throw new BadRequestError('Tenant é obrigatório', ErrorCode.VALIDATION_ERROR);
      }
      const tenantId = req.tenant.id;
      const categoryIds = typeof req.query.categoryIds === 'string'
        ? req.query.categoryIds.split(',').filter(Boolean)
        : [];

      try {
        const stats = await storeOnboardingService.getCategoryProductStats(tenantId, categoryIds);

        return reply.send({ stats });
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw new InternalServerError('Erro ao buscar estatísticas de categorias');
      }
    }
  );

  // GET /marketplace/products/visible
  fastify.get<{
    Querystring: { categoryId?: string; limit?: string; offset?: string };
  }>('/marketplace/products/visible', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { categoryId, limit, offset } = req.query;

    const products = await listVisibleProducts(tenantId, {
      categoryIds: categoryId ? [categoryId] : undefined,
      limit:  limit  ? parseInt(limit,  10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return reply.send({ products });
  });
};

export default storeOnboardingRoutes;

