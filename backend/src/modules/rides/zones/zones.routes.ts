// src/modules/rides/zones/zones.routes.ts
//
// Rotas Fastify para zonas no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { zonesService } from './zones.service';

interface CreateZoneBody {
  cityId: string;
  name: string;
  polygon: any;
}

interface UpdateZoneBody {
  name?: string;
  polygon?: any;
}

const zonesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /zones — cria zona geográfica
  // =====================================================================
  fastify.post<{ Body: CreateZoneBody }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:zones:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { cityId, name, polygon } = req.body;
      const zone = await zonesService.createZone(tenantId, cityId, { name, polygon });

      reply.code(201);
      return zone;
    }
  );

  // =====================================================================
  // GET /zones — lista zonas (filtrado por cityId se fornecido)
  // =====================================================================
  fastify.get(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:zones:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const cityId = (req.query as any).cityId;
      if (cityId) {
        const zones = await zonesService.listZonesByCity(tenantId, cityId);
        return zones;
      }

      // Se não houver cityId, retornar todas as zonas do tenant
      const zones = await zonesService.listZonesByCity(tenantId, '');
      return zones;
    }
  );
};

export default zonesRoutes;
