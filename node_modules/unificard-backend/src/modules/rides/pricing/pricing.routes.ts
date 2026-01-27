// src/modules/rides/pricing/pricing.routes.ts
//
// Rotas Fastify para Pricing no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransaction } from '@core/db';
import { BadRequestError, NotFoundError } from '@core/errors';
import { pricingService } from './pricing.service';

interface PricingConfigBody {
  baseFare: number;
  costPerKm: number;
  costPerMinute: number;
  minimumFare: number;
  cancellationFee?: number;
  nightMultiplier?: number;
  weekendMultiplier?: number;
}

interface SurgeBody {
  zoneId: string;
  multiplier: number;
  activeFrom?: Date;
  activeUntil?: Date;
}

interface EstimateQuery {
  origin_lat: string;
  origin_lng: string;
  dest_lat: string;
  dest_lng: string;
  service_type_id: string;
}

const pricingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /config — obtém a configuração de preços atual
  // =====================================================================
  fastify.get(
    '/config',
    {
      preHandler: [fastify.requirePermission(['rides:pricing:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const config = await runQueryWithTenant<any>(tenantId, {
        text: `
          SELECT
            config_id,
            base_fare,
            cost_per_km,
            cost_per_minute,
            minimum_fare,
            cancellation_fee,
            night_multiplier,
            weekend_multiplier,
            updated_at
          FROM rides_pricing_config
          WHERE tenant_id = $1 AND is_active = TRUE
          ORDER BY updated_at DESC
          LIMIT 1;
        `,
        values: [tenantId],
      });

      if (!config) {
        throw new NotFoundError('Pricing config not found');
      }

      return config;
    }
  );

  // =====================================================================
  // POST /config — atualiza ou cria config de preço
  // =====================================================================
  fastify.post<{ Body: PricingConfigBody }>(
    '/config',
    {
      preHandler: [fastify.requirePermission(['rides:pricing:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const {
        baseFare,
        costPerKm,
        costPerMinute,
        minimumFare,
        cancellationFee,
        nightMultiplier,
        weekendMultiplier,
      } = req.body;

      if (!baseFare || !costPerKm || !costPerMinute || !minimumFare) {
        throw new BadRequestError('Missing pricing parameters');
      }

      const config = await runTenantTransaction(tenantId, async (trx) => {
        // Desativar configs antigas
        await trx.query({
          text: `
            UPDATE rides_pricing_config
            SET is_active = FALSE
            WHERE tenant_id = $1 AND is_active = TRUE;
          `,
          values: [tenantId],
        });

        // Criar nova config
        const rows = await trx.query({
          text: `
            INSERT INTO rides_pricing_config (
              tenant_id,
              base_fare,
              cost_per_km,
              cost_per_minute,
              minimum_fare,
              cancellation_fee,
              night_multiplier,
              weekend_multiplier,
              is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            RETURNING *;
          `,
          values: [
            tenantId,
            baseFare,
            costPerKm,
            costPerMinute,
            minimumFare,
            cancellationFee ?? null,
            nightMultiplier ?? 1.0,
            weekendMultiplier ?? 1.0,
          ],
        });

        return rows[0];
      });

      reply.code(201);
      return config;
    }
  );

  // =====================================================================
  // GET /surge — consulta multiplicadores de dinâmica (surge)
  // =====================================================================
  fastify.get(
    '/surge',
    {
      preHandler: [fastify.requirePermission(['rides:pricing:read'])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const surges = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT
            surge_id,
            zone_id,
            multiplier,
            active_from,
            active_until,
            created_at
          FROM rides_surge_multipliers
          WHERE tenant_id = $1
            AND (active_until IS NULL OR active_until > NOW());
        `,
        values: [tenantId],
      });

      return surges;
    }
  );

  // =====================================================================
  // POST /surge — cria novo multiplicador (admin)
  // =====================================================================
  fastify.post<{ Body: SurgeBody }>(
    '/surge',
    {
      preHandler: [fastify.requirePermission(['rides:pricing:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { zoneId, multiplier, activeFrom, activeUntil } = req.body;

      if (!zoneId) throw new BadRequestError('zoneId required');
      if (!multiplier) throw new BadRequestError('multiplier required');

      const surge = await runTenantTransaction(tenantId, async (trx) => {
        const rows = await trx.query({
          text: `
            INSERT INTO rides_surge_multipliers (
              tenant_id,
              zone_id,
              multiplier,
              active_from,
              active_until
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
          `,
          values: [
            tenantId,
            zoneId,
            multiplier,
            activeFrom ?? new Date(),
            activeUntil ?? null,
          ],
        });

        return rows[0];
      });

      reply.code(201);
      return surge;
    }
  );

  // =====================================================================
  // GET /estimate — preview de preço da corrida
  // =====================================================================
  fastify.get<{ Querystring: EstimateQuery }>(
    '/estimate',
    {
      preHandler: [fastify.requirePermission(['rides:pricing:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const {
        origin_lat,
        origin_lng,
        dest_lat,
        dest_lng,
        service_type_id,
      } = req.query;

      if (
        !origin_lat ||
        !origin_lng ||
        !dest_lat ||
        !dest_lng ||
        !service_type_id
      ) {
        throw new BadRequestError('Missing required parameters');
      }

      // Buscar config
      const config = await runQueryWithTenant<any>(tenantId, {
        text: `
          SELECT
            base_fare,
            cost_per_km,
            cost_per_minute,
            minimum_fare
          FROM rides_pricing_config
          WHERE tenant_id = $1 AND is_active = TRUE
          LIMIT 1;
        `,
        values: [tenantId],
      });

      if (!config) {
        throw new NotFoundError('Pricing config missing');
      }

      // Aqui você chamaria seu serviço de rota/direção (Maps API)
      const fakeDistanceKm = 5.2;
      const fakeDurationMin = 13;

      // Buscar surge aplicado para zona
      const surge = await runQueryWithTenant<{ multiplier: number }>(tenantId, {
        text: `
          SELECT multiplier
          FROM rides_surge_multipliers
          WHERE tenant_id = $1
            AND zone_id = (
              SELECT zone_id
              FROM rides_zones
              WHERE tenant_id = $1
                AND ST_Contains(polygon, ST_Point($2, $3))
              LIMIT 1
            )
            AND (active_until IS NULL OR active_until > NOW())
          ORDER BY active_from DESC
          LIMIT 1;
        `,
        values: [tenantId, Number(origin_lng), Number(origin_lat)],
      });

      const surgeMultiplier = surge?.multiplier ?? 1.0;

      const price =
        config.base_fare +
        config.cost_per_km * fakeDistanceKm +
        config.cost_per_minute * fakeDurationMin;

      const finalPrice = Math.max(price * surgeMultiplier, config.minimum_fare);

      return {
        distance_km: fakeDistanceKm,
        duration_min: fakeDurationMin,
        surge_multiplier: surgeMultiplier,
        estimated_price: finalPrice,
      };
    }
  );
};

export default pricingRoutes;
