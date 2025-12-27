// src/modules/rides/distribution/distribution.routes.ts
//
// Rotas Fastify para distribuição financeira no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { distributionService } from './distribution.service';

interface RideParams {
  rideId: string;
}

interface ApplyDistributionBody {
  // Opcional: permitir sobrescrever regras
  [key: string]: any;
}

const distributionRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /rides/:rideId — distribuição de uma corrida específica
  // =====================================================================
  fastify.get<{ Params: RideParams }>(
    '/rides/:rideId',
    {
      preHandler: [fastify.requirePermission(['rides:distribution:read'])],
    },
    async (req, _reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { rideId } = req.params;
      const distribution = await distributionService.getByRideId(tenantId, rideId);
      return distribution;
    }
  );

  // =====================================================================
  // POST /rides/:rideId/apply — aplica/reaplica distribuição em uma corrida
  // =====================================================================
  fastify.post<{ Params: RideParams; Body: ApplyDistributionBody }>(
    '/rides/:rideId/apply',
    {
      preHandler: [fastify.requirePermission(['rides:distribution:write'])],
    },
    async (req, _reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { rideId } = req.params;
      const distribution = await distributionService.applyDistributionToRide(tenantId, rideId, req.body);
      return distribution;
    }
  );
};

export default distributionRoutes;
