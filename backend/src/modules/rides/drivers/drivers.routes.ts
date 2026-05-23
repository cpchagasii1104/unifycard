// src/modules/rides/drivers/drivers.routes.ts
//
// Rotas Fastify para o módulo de Motoristas (Rides)

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransaction } from '@core/db';
import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
import { driversService } from './drivers.service';

interface DriverParams {
  driverId: string;
}

interface CreateDriverBody {
  fullName?: string;
}

interface UpdateAvailabilityBody {
  isAvailable: boolean;
}

const driversRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /drivers — lista motoristas do tenant
  // =====================================================================
  fastify.get(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const drivers = await driversService.listDrivers(tenantId);
      return drivers;
    }
  );

  // =====================================================================
  // GET /drivers/:driverId — detalhes de um motorista
  // =====================================================================
  fastify.get<{ Params: DriverParams }>(
    '/:driverId',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;

      const row = await runQueryWithTenant<{
        driver_id: string;
        user_id: string;
        status: string;
        level: string;
        active_vehicle_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>(tenantId, {
        text: `
          SELECT
            driver_id,
            user_id,
            status,
            level,
            active_vehicle_id,
            created_at,
            updated_at
          FROM rides_drivers
          WHERE tenant_id = $1 AND driver_id = $2;
        `,
        values: [tenantId, driverId],
      });

      if (!row) {
        throw new NotFoundError('Driver not found');
      }

      return {
        driver_id: row.driver_id,
        user_id: row.user_id,
        status: row.status,
        level: row.level,
        active_vehicle_id: row.active_vehicle_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  );

  // =====================================================================
  // POST /drivers — cria perfil de motorista
  // =====================================================================
  fastify.post<{ Body: CreateDriverBody }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId) throw new BadRequestError('Missing tenant context');
      if (!userId) throw new BadRequestError('Missing authenticated user');

      const driver = await driversService.createDriver(tenantId, userId);

      reply.code(201);
      return driver;
    }
  );

  // =====================================================================
  // PATCH /drivers/:driverId/availability — muda status de disponibilidade
  // =====================================================================
  fastify.patch<{ Params: DriverParams; Body: UpdateAvailabilityBody }>(
    '/:driverId/availability',
    {
      preHandler: [fastify.requirePermission(['rides:drivers:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { driverId } = req.params;
      const { isAvailable } = req.body;

      if (typeof isAvailable !== 'boolean') {
        throw new BadRequestError('isAvailable must be boolean');
      }

      const row = await runQueryWithTenant<{
        driver_id: string;
        is_available: boolean;
        updated_at: Date;
      }>(tenantId, {
        text: `
          UPDATE rides_driver_availability
          SET is_available = $3, updated_at = NOW()
          WHERE tenant_id = $1 AND driver_id = $2
          RETURNING driver_id, is_available, updated_at;
        `,
        values: [tenantId, driverId, isAvailable],
      });

      if (!row) {
        throw new NotFoundError('Driver availability not found');
      }

      return {
        driver_id: row.driver_id,
        is_available: row.is_available,
        updatedAt: row.updated_at,
      };
    }
  );
};

export default driversRoutes;
