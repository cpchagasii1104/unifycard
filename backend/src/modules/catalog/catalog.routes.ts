// src/modules/catalog/catalog.routes.ts
// Rotas READ-ONLY do catálogo canônico

import { FastifyPluginAsync } from 'fastify';
import { catalogService } from './catalog.service';
import { offerService } from './offer.service';

const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /catalog/search?q=query&regionId=&type=
   * Busca produtos no catálogo (canônicos + locais)
   */
  fastify.get<{
    Querystring: {
      q: string;
      regionId?: string;
      cityId?: string;
      categoryId?: string;
      type?: 'INDUSTRIAL' | 'LOCAL' | 'ALL';
      limit?: string;
      offset?: string;
    };
  }>('/search', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { q, regionId, cityId, categoryId, type, limit, offset } = req.query;

    if (!q || q.trim().length === 0) {
      return reply.status(400).send({
        error: 'Query parameter "q" is required',
      });
    }

    const result = await catalogService.search(tenantId, q.trim(), {
      regionId,
      cityId,
      categoryId,
      type: type || 'ALL',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return reply.send(result);
  });

  /**
   * GET /catalog/product/:id
   * Busca produto canônico por ID
   */
  fastify.get<{ Params: { id: string } }>('/product/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const product = await catalogService.findById(tenantId, id);

    if (!product) {
      return reply.status(404).send({
        error: 'Product not found',
      });
    }

    return reply.send(product);
  });

  /**
   * GET /catalog/product/:id/offers?regionId=&activeOnly=
   * Lista ofertas de um produto canônico
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      regionId?: string;
      cityId?: string;
      activeOnly?: string;
      limit?: string;
      offset?: string;
    };
  }>('/product/:id/offers', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;
    const { regionId, cityId, activeOnly, limit, offset } = req.query;

    // Verificar se produto existe
    const product = await catalogService.findById(tenantId, id);
    if (!product) {
      return reply.status(404).send({
        error: 'Product not found',
      });
    }

    const offers = await offerService.listOffersByProduct(tenantId, id, {
      regionId,
      cityId,
      activeOnly: activeOnly !== 'false',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return reply.send({ offers });
  });
};

export default catalogRoutes;



