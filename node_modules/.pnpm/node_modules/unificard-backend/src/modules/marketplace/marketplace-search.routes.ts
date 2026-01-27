// backend/src/modules/marketplace/marketplace-search.routes.ts
// Rotas para Marketplace Search
// 🔴 BLINDAGEM: Ranking determinístico e explicável

import type { FastifyInstance } from 'fastify';
import { marketplaceSearchService } from './marketplace-search.service';
import type { MarketplaceSearchFilters } from './marketplace-search.types';

const marketplaceSearchRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /marketplace/search
   * Busca serviços no Marketplace com ranking determinístico
   */
  fastify.get<{
    Querystring: {
      categoryPath: string; // Obrigatório: "bebidas" ou "bebidas/refrigerantes"
      startDate?: string;
      endDate?: string;
      cityId?: string;
      stateId?: string;
      countryId?: string;
      capacityMin?: number;
      capacityMax?: number;
      priceMin?: number;
      priceMax?: number;
      currency?: string;
      availability?: string; // Comma-separated: "available,partial"
      trustLevel?: string;
      actorType?: string;
      limit?: number;
      offset?: number;
    };
  }>('/marketplace/search', async (req, reply) => {
    const tenantId = req.tenant.id;

    // Validar categoryPath obrigatório
    if (!req.query.categoryPath) {
      return reply.status(400).send({ error: 'categoryPath é obrigatório' });
    }

    const categoryPath = req.query.categoryPath.split('/').filter((p) => p);

    const filters: MarketplaceSearchFilters = {
      categoryPath,
      dateRange:
        req.query.startDate && req.query.endDate
          ? {
              start: new Date(req.query.startDate),
              end: new Date(req.query.endDate),
            }
          : undefined,
      location:
        req.query.cityId || req.query.stateId || req.query.countryId
          ? {
              cityId: req.query.cityId,
              stateId: req.query.stateId,
              countryId: req.query.countryId,
            }
          : undefined,
      capacity:
        req.query.capacityMin !== undefined || req.query.capacityMax !== undefined
          ? {
              min: req.query.capacityMin,
              max: req.query.capacityMax,
            }
          : undefined,
      priceRange:
        req.query.priceMin !== undefined || req.query.priceMax !== undefined
          ? {
              min: req.query.priceMin,
              max: req.query.priceMax,
              currency: req.query.currency || 'BRL',
            }
          : undefined,
      availability: req.query.availability
        ? (req.query.availability.split(',') as any[])
        : undefined,
      trustLevel: req.query.trustLevel as any,
      actorType: req.query.actorType as any,
      limit: req.query.limit ? parseInt(req.query.limit.toString()) : 20,
      offset: req.query.offset ? parseInt(req.query.offset.toString()) : 0,
    };

    try {
      const response = await marketplaceSearchService.search(tenantId, filters);
      return reply.send(response);
    } catch (err: any) {
      req.log.error({ err }, 'Erro ao buscar no marketplace');
      return reply.status(500).send({
        error: 'Erro ao buscar no marketplace',
        message: err.message,
      });
    }
  });
};

export default marketplaceSearchRoutes;




