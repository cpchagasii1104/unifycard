import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError } from '@core/errors';
import { vehiclesService } from './vehicles.service';

interface VehicleParams {
  vehicleId: string;
  driverId?: string;
}

interface CreateVehicleBody {
  plate: string;
  model?: string;
  brand?: string;
  year?: number;
  color?: string;
  category?: string;
  serviceTypeId?: string;
}

interface UpdateVehicleBody {
  plate?: string;
  model?: string;
  brand?: string;
  year?: number;
  color?: string;
  category?: string;
  serviceTypeId?: string;
}

interface VerifyVehicleBody {
  partnerId: string;
}

const vehiclesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /drivers/:driverId/vehicles — cria veículo
  // =====================================================================
  fastify.post<{ Params: { driverId: string }; Body: CreateVehicleBody }>(
    '/drivers/:driverId/vehicles',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;
      const vehicle = await vehiclesService.createVehicle({
        tenantId,
        driverId,
        ...req.body,
      });

      reply.code(201);
      return vehicle;
    }
  );

  // =====================================================================
  // GET /drivers/:driverId/vehicles — lista veículos do motorista
  // =====================================================================
  fastify.get<{ Params: { driverId: string } }>(
    '/drivers/:driverId/vehicles',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;
      const vehicles = await vehiclesService.listVehicles(tenantId, driverId);
      return vehicles;
    }
  );

  // =====================================================================
  // GET /vehicles/:vehicleId — detalhes de um veículo
  // =====================================================================
  fastify.get<{ Params: VehicleParams }>(
    '/vehicles/:vehicleId',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { vehicleId } = req.params;
      const vehicle = await vehiclesService.getVehicleById(tenantId, vehicleId);
      return vehicle;
    }
  );

  // =====================================================================
  // PATCH /vehicles/:vehicleId — atualiza veículo
  // =====================================================================
  fastify.patch<{ Params: VehicleParams; Body: UpdateVehicleBody }>(
    '/vehicles/:vehicleId',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { vehicleId } = req.params;
      const vehicle = await vehiclesService.updateVehicle(tenantId, vehicleId, req.body);
      return vehicle;
    }
  );

  // =====================================================================
  // POST /vehicles/:vehicleId/verify — verificação em loja parceira
  // =====================================================================
  fastify.post<{ Params: VehicleParams; Body: VerifyVehicleBody }>(
    '/vehicles/:vehicleId/verify',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { vehicleId } = req.params;
      const { partnerId } = req.body;
      const vehicle = await vehiclesService.verifyVehicle(tenantId, vehicleId, partnerId);
      return vehicle;
    }
  );
};

export default vehiclesRoutes;
