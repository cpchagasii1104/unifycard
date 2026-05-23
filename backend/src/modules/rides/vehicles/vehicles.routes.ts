// src/modules/rides/vehicles/vehicles.routes.ts
//
// Rotas Fastify para gestão de veículos no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransaction } from '@core/db';
import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
import { vehiclesService } from './vehicles.service';

interface VehicleParams {
  vehicleId: string;
}

interface CreateVehicleBody {
  plate: string;
  model: string;
  color?: string;
  year?: number;
  category?: string;
}

interface UpdateActiveBody {
  isActive: boolean;
}

const vehiclesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /vehicles — lista veículos do tenant
  // =====================================================================
  fastify.get(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const vehicles = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT
            vehicle_id,
            driver_id,
            plate,
            model,
            color,
            year,
            category,
            is_active,
            created_at
          FROM rides_vehicles
          WHERE tenant_id = $1
          ORDER BY created_at DESC;
        `,
        values: [tenantId],
      });

      return vehicles;
    }
  );

  // =====================================================================
  // GET /vehicles/:vehicleId — detalhes de um veículo
  // =====================================================================
  fastify.get<{ Params: VehicleParams }>(
    '/:vehicleId',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { vehicleId } = req.params;
      const vehicle = await vehiclesService.getVehicle(tenantId, vehicleId);
      return vehicle;
    }
  );

  // =====================================================================
  // POST /vehicles — registra um novo veículo
  // =====================================================================
  fastify.post<{ Body: CreateVehicleBody }>(
    '/',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId) throw new BadRequestError('Missing tenant context');
      if (!userId) throw new BadRequestError('Missing authenticated user');

      const { plate, model, color, year, category } = req.body;

      if (!plate) throw new BadRequestError('Plate is required');
      if (!model) throw new BadRequestError('Model is required');

      const vehicle = await runTenantTransaction(tenantId, async (trx) => {
        // Verifica se o usuário possui DRIVER_PROFILE
        const driverRows = await trx.query({
          text: `
            SELECT driver_id FROM rides_drivers
            WHERE tenant_id = $1 AND user_id = $2
            LIMIT 1;
          `,
          values: [tenantId, userId],
        });

        if (driverRows.length === 0) {
          throw new ConflictError('User has no driver profile');
        }

        const driverId = driverRows[0].driver_id;

        // Placa deve ser única por tenant
        const exists = await trx.query({
          text: `
            SELECT vehicle_id FROM rides_vehicles
            WHERE tenant_id = $1 AND plate = $2
            LIMIT 1;
          `,
          values: [tenantId, plate],
        });

        if (exists.length > 0) {
          throw new ConflictError('Vehicle with this plate already exists');
        }

        const rows = await trx.query({
          text: `
            INSERT INTO rides_vehicles
              (tenant_id, driver_id, plate, model, color, year, category, is_active, created_at)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, true, now())
            RETURNING *;
          `,
          values: [
            tenantId,
            driverId,
            plate,
            model,
            color ?? null,
            year ?? null,
            category ?? 'standard',
          ],
        });

        return rows[0];
      });

      reply.code(201);
      return vehicle;
    }
  );

  // =====================================================================
  // PATCH /vehicles/:vehicleId/active — ativa/desativa um veículo
  // =====================================================================
  fastify.patch<{ Params: VehicleParams; Body: UpdateActiveBody }>(
    '/:vehicleId/active',
    {
      preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { vehicleId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        throw new BadRequestError('isActive must be boolean');
      }

      const vehicle = await runQueryWithTenant<any>(tenantId, {
        text: `
          UPDATE rides_vehicles
          SET is_active = $3, updated_at = NOW()
          WHERE tenant_id = $1 AND vehicle_id = $2
          RETURNING *;
        `,
        values: [tenantId, vehicleId, isActive],
      });

      if (!vehicle) {
        throw new NotFoundError('Vehicle not found');
      }

      return vehicle;
    }
  );
};

export default vehiclesRoutes;
