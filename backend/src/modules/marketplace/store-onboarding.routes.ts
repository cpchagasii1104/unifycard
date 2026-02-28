// backend/src/modules/marketplace/store-onboarding.routes.ts
// Rotas para Store Onboarding
// 🔴 BLINDAGEM: Loja apenas seleciona recortes, não cria categorias

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { storeOnboardingService } from './store-onboarding.service';
import type { BusinessAction } from '@core/authorization/business-permissions.types';

const storeOnboardingRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar Store Onboarding
   */
  const requireStorePermission = async (req: any, reply: any, action: BusinessAction) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findOrCreateUserActor(tenantId, userId);
      if (!actor) {
        return reply.status(403).send({ error: 'Actor não encontrado' });
      }

      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        action,
        'store_onboarding'
      );
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar Store Onboarding' });
    }
  };

  /**
   * POST /marketplace/store-onboarding
   * Cria onboarding de loja
   */
  fastify.post<{
    Body: {
      actorId: string;
      departmentCategoryId: string;
      selectedCategoryIds: string[];
      hasOwnProducts: boolean;
      defaultCostPrice?: number;
      defaultSalePrice?: number;
      defaultStock?: number;
      metadata?: Record<string, any>;
    };
  }>(
    '/marketplace/store-onboarding',
    {
      preHandler: async (req, reply) => {
        await requireStorePermission(req, reply, 'MARKETPLACE_STORE_CREATE');
      },
    },
    async (req, reply) => {
      // Validação manual com Zod
      const bodySchema = z.object({
        actorId: z.string().uuid(),
        departmentCategoryId: z.string().uuid(),
        selectedCategoryIds: z.array(z.string().uuid()),
        hasOwnProducts: z.boolean(),
        defaultCostPrice: z.number().optional(),
        defaultSalePrice: z.number().optional(),
        defaultStock: z.number().int().min(0).optional(),
        metadata: z.record(z.any()).optional(),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: validationResult.error.errors,
        });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.userId ?? req.user?.id ?? '';
      const actorId = req.user?.id ?? userId;

      try {
        const result = await storeOnboardingService.createStoreOnboarding(
          tenantId,
          validationResult.data,
          actorId,
          userId
        );

        return reply.send({ result });
      } catch (err: any) {
        req.log.error({ err }, 'Erro ao criar onboarding de loja');
        return reply.status(400).send({
          error: 'Erro ao criar onboarding de loja',
          message: err.message,
        });
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
  }>(
    '/marketplace/store-onboarding/available-products',
    {
      preHandler: async (req, reply) => {
        await requireStorePermission(req, reply, 'MARKETPLACE_STORE_VIEW');
      },
    },
    async (req, reply) => {
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
      } catch (err: any) {
        req.log.error({ err }, 'Erro ao listar produtos disponíveis');
        return reply.status(500).send({
          error: 'Erro ao listar produtos disponíveis',
          message: err.message,
        });
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
      const tenantId = req.tenant.id;
      const categoryIds = typeof req.query.categoryIds === 'string'
        ? req.query.categoryIds.split(',').filter(Boolean)
        : [];

      try {
        const stats = await storeOnboardingService.getCategoryProductStats(tenantId, categoryIds);

        return reply.send({ stats });
      } catch (err: any) {
        req.log.error({ err }, 'Erro ao buscar estatísticas de categorias');
        return reply.status(500).send({
          error: 'Erro ao buscar estatísticas de categorias',
          message: err.message,
        });
      }
    }
  );
};

export default storeOnboardingRoutes;

