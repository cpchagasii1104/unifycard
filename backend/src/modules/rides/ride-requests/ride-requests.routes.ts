// src/modules/rides/ride-requests/ride-requests.routes.ts
//
// Rotas Fastify para solicitações de corrida no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { assertRideAuthority } from '../shared/ride-authority';
import { rideRequestsService } from './ride-requests.service';

interface CreateRequestBody {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  stops?: Array<{ lat: number; lng: number }>;
  passenger_count?: number;
  service_type_id?: string;
  city_id?: string;
}

interface AcceptRequestParams {
  requestId: string;
}

interface CancelRequestParams {
  requestId: string;
}

const rideRequestsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /requests — criar solicitação de corrida
  // =====================================================================
  fastify.post<{ Body: CreateRequestBody }>(
    '/requests',
    {
      preHandler: [fastify.requirePermission(['rides:ride-requests:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      await assertRideAuthority(req, tenantId, userId, 'request_ride');

      const result = await rideRequestsService.createRequest(tenantId, userId, req.body);

      reply.code(201);
      return result;
    }
  );

  // =====================================================================
  // POST /requests/:requestId/accept — motorista aceita corrida
  // =====================================================================
  fastify.post<{ Params: AcceptRequestParams }>(
    '/requests/:requestId/accept',
    {
      preHandler: [fastify.requirePermission(['rides:ride-requests:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { requestId } = req.params;

      await assertRideAuthority(req, tenantId, userId, 'accept_ride', requestId);
      
      // Buscar driver_id do usuário
      const { driversService } = await import('../drivers/drivers.service');
      const driver = await driversService.getDriverByUserId(tenantId, userId);
      
      if (!driver) {
        throw new BadRequestError('Driver profile not found');
      }

      const updated = await rideRequestsService.driverAccept(tenantId, driver.driver_id, requestId);
      return updated;
    }
  );

  // =====================================================================
  // POST /requests/:requestId/cancel — cancelar solicitação
  // =====================================================================
  fastify.post<{ Params: CancelRequestParams }>(
    '/requests/:requestId/cancel',
    {
      preHandler: [fastify.requirePermission(['rides:ride-requests:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { requestId } = req.params;

      await assertRideAuthority(req, tenantId, userId, 'request_ride', requestId);

      const result = await rideRequestsService.cancelRequest(tenantId, requestId, userId);
      return result;
    }
  );
};

export default rideRequestsRoutes;
