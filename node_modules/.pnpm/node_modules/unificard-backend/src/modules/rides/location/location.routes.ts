// src/modules/rides/location/location.routes.ts
//
// Rotas Fastify para localização no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { locationService } from './location.service';

interface UpdateLocationBody {
  driverId: string;
  lat: number;
  lng: number;
}

interface DistanceQuery {
  lat1: string;
  lng1: string;
  lat2: string;
  lng2: string;
}

const locationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /drivers/location — receber ping de localização
  // =====================================================================
  fastify.post<{ Body: UpdateLocationBody }>(
    '/drivers/location',
    {
      preHandler: [fastify.requirePermission(['rides:location:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId, lat, lng } = req.body;
      const result = await locationService.updateLocation({
        tenantId,
        driverId,
        lat,
        lng,
      });

      return result;
    }
  );

  // =====================================================================
  // GET /location/distance — calcular distância/ETA
  // =====================================================================
  fastify.get<{ Querystring: DistanceQuery }>(
    '/location/distance',
    {
      preHandler: [fastify.requirePermission(['rides:location:read'])],
    },
    async (req, reply) => {
      const { lat1, lng1, lat2, lng2 } = req.query;

      const distance = await locationService.calculateDistanceMeters(
        Number(lat1),
        Number(lng1),
        Number(lat2),
        Number(lng2),
      );

      const eta = await locationService.calculateETASeconds(distance);

      return {
        distance_meters: distance,
        eta_seconds: eta,
      };
    }
  );
};

export default locationRoutes;
