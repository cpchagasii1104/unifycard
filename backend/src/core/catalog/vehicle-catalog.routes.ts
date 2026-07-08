// backend/src/core/catalog/vehicle-catalog.routes.ts
// Leitura do catálogo GOVERNADO de marca/modelo de veículo — reutilizável por qualquer módulo
// (rides, locação, marketplace de veículos, peças automotivas). Zero texto livre no cliente.

import type { FastifyPluginAsync } from 'fastify';
import { vehicleCatalogService } from './vehicle-catalog.service';

const vehicleCatalogRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /catalog/vehicles/makes?q=&conceptId= — conceptId filtra por categoria (só marcas que a fazem)
  fastify.get<{ Querystring: { q?: string; conceptId?: string } }>('/makes', async (req, reply) => {
    const makes = await vehicleCatalogService.searchMakes(req.query.q, req.query.conceptId);
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

  // GET /catalog/vehicles/models/:modelId/years/:year/versions — versões (trims) + ficha técnica
  // AUTO-COMPLETADA (a verdade é do catálogo; o anunciante não digita spec). Read-only.
  fastify.get<{ Params: { modelId: string; year: string } }>('/models/:modelId/years/:year/versions', async (req, reply) => {
    const y = parseInt(req.params.year, 10);
    if (!Number.isFinite(y)) return reply.status(400).send({ error: 'year inválido' });
    const versions = await vehicleCatalogService.listVersionsWithSpecs(req.params.modelId, y);
    return reply.send({ ok: true, data: versions });
  });
};

export default vehicleCatalogRoutes;
