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

  // GET /catalog/vehicles/makes/:makeId/models?conceptId=&q=
  // conceptId OBRIGATÓRIO (fix 2ª IA: modelo pertence a marca+tipo — sem isso, Civic e CG160
  // aparecem juntos só por serem Honda).
  fastify.get<{ Params: { makeId: string }; Querystring: { conceptId?: string; q?: string } }>(
    '/makes/:makeId/models',
    async (req, reply) => {
      if (!req.query.conceptId) {
        return reply.status(400).send({ error: 'conceptId é obrigatório (modelo depende do tipo de veículo, não só da marca)' });
      }
      const models = await vehicleCatalogService.listModelsByMakeAndConcept(req.params.makeId, req.query.conceptId, req.query.q);
      return reply.send({ ok: true, data: models });
    }
  );

  // GET /catalog/vehicles/models/:modelId/years — anos GOVERNADOS do modelo (F-VEHICLE-MODEL-YEAR).
  // A verdade é vehicle_model_years; vazio = modelo sem anos governados (ainda). Read-only.
  fastify.get<{ Params: { modelId: string } }>('/models/:modelId/years', async (req, reply) => {
    const years = await vehicleCatalogService.listModelYears(req.params.modelId);
    return reply.send({ ok: true, data: years });
  });
};

export default vehicleCatalogRoutes;
