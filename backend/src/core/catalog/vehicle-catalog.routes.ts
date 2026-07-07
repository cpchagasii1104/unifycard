// backend/src/core/catalog/vehicle-catalog.routes.ts
// Leitura do catálogo GOVERNADO de marca/modelo de veículo — reutilizável por qualquer módulo
// (rides, locação, marketplace de veículos, peças automotivas). Zero texto livre no cliente.

import type { FastifyPluginAsync } from 'fastify';
import { vehicleCatalogService } from './vehicle-catalog.service';

const vehicleCatalogRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /catalog/vehicles/makes?q=
  fastify.get<{ Querystring: { q?: string } }>('/makes', async (req, reply) => {
    const makes = await vehicleCatalogService.searchMakes(req.query.q);
    return reply.send({ ok: true, data: makes });
  });

  // GET /catalog/vehicles/makes/:makeId/models?q=
  fastify.get<{ Params: { makeId: string }; Querystring: { q?: string } }>(
    '/makes/:makeId/models',
    async (req, reply) => {
      const models = await vehicleCatalogService.listModelsByMake(req.params.makeId, req.query.q);
      return reply.send({ ok: true, data: models });
    }
  );
};

export default vehicleCatalogRoutes;
