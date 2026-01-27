// src/modules/rides/demand/demand.routes.ts
//
// Rotas Fastify para Demand no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransaction } from '@core/db';
import { BadRequestError, NotFoundError } from '@core/errors';

interface ZoneParams {
  zoneId: string;
}

interface CreateIncentiveBody {
  value: number;
  reason?: string;
}

const demandRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /zones/:zoneId — consulta pressão atual de uma zona
  // =====================================================================
  fastify.get<{ Params: ZoneParams }>(
    '/zones/:zoneId',
    {
      preHandler: [fastify.requirePermission(['rides:demand:read'])],
    },
    async (req, _reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { zoneId } = req.params;
      const zone = await runQueryWithTenant<any>(tenantId, {
        text: `
          SELECT
            z.zone_id,
            z.name,
            z.city_id,
            z.polygon,
            dp.pressure,
            dp.level,
            dp.active_requests,
            dp.available_drivers,
            dp.calculated_at
          FROM rides_zones z
          LEFT JOIN rides_zone_demand_pressure dp
            ON dp.zone_id = z.zone_id
          WHERE z.tenant_id = $1 AND z.zone_id = $2;
        `,
        values: [tenantId, zoneId],
      });

      if (!zone) {
        throw new NotFoundError('Zone not found');
      }

      return zone;
    }
  );

  // =====================================================================
  // POST /zones/:zoneId/recalculate — recalcula pressão da zona
  // =====================================================================
  fastify.post<{ Params: ZoneParams }>(
    '/zones/:zoneId/recalculate',
    {
      preHandler: [fastify.requirePermission(['rides:demand:write'])],
    },
    async (req, _reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { zoneId } = req.params;

      const result = await runTenantTransaction(tenantId, async (trx) => {
        // Recalcular pressão
        const calcRows = await trx.query({
          text: `
            SELECT *
            FROM rides_calculate_zone_pressure($1, $2);
          `,
          values: [tenantId, zoneId],
        });

        const calc = calcRows[0];
        if (!calc) {
          throw new NotFoundError('Zone not found or no pressure result');
        }

        // Incentivo automático (depende da função SQL)
        const incentiveRows = await trx.query({
          text: `
            SELECT
              rides_create_auto_zone_incentive($1, $2, 'auto-demand') AS incentive_id;
          `,
          values: [tenantId, zoneId],
        });

        return {
          pressure: calc,
          incentiveId: incentiveRows[0]?.incentive_id ?? null,
        };
      });

      return {
        recalculated: result.pressure,
        incentive_triggered: result.incentiveId,
      };
    }
  );

  // =====================================================================
  // GET /pressure — heatmap geral (todas as zonas)
  // =====================================================================
  fastify.get(
    '/pressure',
    {
      preHandler: [fastify.requirePermission(['rides:demand:read'])],
    },
    async (req: FastifyRequest, _reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const zones = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT
            z.zone_id,
            z.name,
            dp.pressure,
            dp.level,
            dp.active_requests,
            dp.available_drivers,
            dp.calculated_at
          FROM rides_zones z
          LEFT JOIN rides_zone_demand_pressure dp
            ON dp.zone_id = z.zone_id
          WHERE z.tenant_id = $1
          ORDER BY dp.level DESC NULLS LAST, z.name ASC;
        `,
        values: [tenantId],
      });

      return zones;
    }
  );

  // =====================================================================
  // POST /zones/:zoneId/incentives — cria incentivo manualmente
  // =====================================================================
  fastify.post<{ Params: ZoneParams; Body: CreateIncentiveBody }>(
    '/zones/:zoneId/incentives',
    {
      preHandler: [fastify.requirePermission(['rides:demand:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { zoneId } = req.params;
      const { value, reason } = req.body;

      if (!value) throw new BadRequestError('value required');

      const result = await runTenantTransaction(tenantId, async (trx) => {
        const rows = await trx.query({
          text: `
            INSERT INTO rides_zone_incentives (
              tenant_id,
              zone_id,
              value,
              reason,
              active_from,
              active_until
            )
            VALUES ($1, $2, $3, $4, NOW(), NULL)
            RETURNING *;
          `,
          values: [tenantId, zoneId, value, reason ?? 'manual'],
        });

        return rows[0];
      });

      reply.code(201);
      return result;
    }
  );
};

export default demandRoutes;