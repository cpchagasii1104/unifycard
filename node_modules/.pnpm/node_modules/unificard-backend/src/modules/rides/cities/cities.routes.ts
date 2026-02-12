// src/modules/rides/cities/cities.routes.ts
//
// Rotas Fastify para o módulo de Cidades (Rides)
// Prefixo real: /rides/cities (definido em rides.module.ts)

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant } from '@core/db';
import { NotFoundError, BadRequestError } from '@core/errors';
import { citiesService } from './cities.service';

// ------------------------------------------------------------
// Tipos auxiliares
// ------------------------------------------------------------

interface CityParams {
  cityId: string;
}

interface CreateCityBody {
  name: string;
  state?: string;
  country?: string;
}

// ------------------------------------------------------------
// Plugin de rotas
// ------------------------------------------------------------

const citiesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /cities — lista todas as cidades operadas
  // =====================================================================
  fastify.get(
    '/',
    async (req: FastifyRequest, _reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const rows = await runQueriesWithTenant<{
        city_id: string;
        name: string;
        state: string | null;
        country: string | null;
        is_active: boolean;
      }>(tenantId, {
        text: `
          SELECT city_id AS id, name, state, country, is_active
          FROM rides_cities
          ORDER BY name ASC;
        `,
      });

      return rows.map((row) => ({
        id: row.city_id,
        name: row.name,
        state: row.state,
        country: row.country,
        is_active: row.is_active,
      }));
    }
  );

  // =====================================================================
  // GET /cities/:cityId — detalhes de uma cidade
  // =====================================================================
  fastify.get<{ Params: CityParams }>(
    '/:cityId',
    async (req, _reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { cityId } = req.params;

      const city = await runQueryWithTenant<{
        city_id: string;
        name: string;
        state: string | null;
        country: string | null;
        is_active: boolean;
      }>(tenantId, {
        text: `
          SELECT city_id AS id, name, state, country, is_active
          FROM rides_cities
          WHERE city_id = $1;
        `,
        values: [cityId],
      });

      if (!city) {
        throw new NotFoundError('City not found');
      }

      return {
        id: city.city_id,
        name: city.name,
        state: city.state,
        country: city.country,
        is_active: city.is_active,
      };
    }
  );

  // =====================================================================
  // POST /cities — cria cidade (com permissão)
  // =====================================================================
  fastify.post<{ Body: CreateCityBody }>(
    '/',
    {
      preHandler: [
        fastify.requirePermission(['rides:cities:write']), // 🔥 RBAC Fastify
      ],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const city = await citiesService.createCity(tenantId, req.body);

      reply.code(201);
      return city;
    }
  );
};

export default citiesRoutes;
