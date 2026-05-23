// ------------------------------------------------------------
// src/modules/rides/availability/availability.routes.ts
// Disponibilidade do motorista — Fastify Unificard v1
// ------------------------------------------------------------

import type {
  FastifyPluginAsync,
  FastifyInstance,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
import { runQueryWithTenant, runTenantTransaction } from '@core/db';

// ------------------------------------------------------------
// Tipos dos bodies (únicos, corretos)
// ------------------------------------------------------------

export interface OnlineBody {
  lat: number;
  lng: number;
  cityId: string;
  vehicleId?: string | null;
}

export interface LocationBody {
  lat: number;
  lng: number;
}

// ------------------------------------------------------------
// Plugin Fastify
// ------------------------------------------------------------

const availabilityRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // ============================================================
  // POST /availability/online
  // ============================================================
  fastify.post<{ Body: OnlineBody }>(
    '/online',
    {
      preHandler: [fastify.requirePermission(['rides:availability:write'])],
    },
    async (
      req: FastifyRequest<{ Body: OnlineBody }>,
      _reply: FastifyReply
    ) => {

      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const { lat, lng, cityId, vehicleId } = req.body;

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !cityId) {
        throw new BadRequestError('lat, lng and cityId are required');
      }

      const result = await runTenantTransaction(tenantId, async (trx) => {
        // Buscar driver_id
        const [driver] = (await trx.query({
          text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE user_id = $1
            LIMIT 1;
          `,
          values: [userId],
        })) as Array<{ driver_id: string }>;

        if (!driver) throw new NotFoundError('Driver profile not found');
        const driverId = driver.driver_id;

        // Verificar limite de condução
        const [limit] = (await trx.query({
          text: `
            SELECT *
            FROM rides_check_driving_limit($1, $2);
          `,
          values: [tenantId, driverId],
        })) as Array<{
          can_drive: boolean;
          warning?: string | null;
          driving_minutes?: number | null;
          forced_break_until?: string | null;
        }>;

        if (!limit?.can_drive) {
          throw new ConflictError(limit?.warning ?? 'Driving limit reached');
        }

        // Criar nova sessão
        const [session] = (await trx.query({
          text: `
            INSERT INTO rides_driver_sessions (
              driver_id, vehicle_id, city_id,
              startedAt, driving_minutes, forced_break_until
            )
            VALUES ($1, $2, $3, NOW(), $4, $5)
            RETURNING *;
          `,
          values: [
            driverId,
            vehicleId ?? null,
            cityId,
            limit.driving_minutes ?? 0,
            limit.forced_break_until ?? null,
          ],
        })) as any[];

        // Availability = TRUE
        const [availability] = (await trx.query({
          text: `
            INSERT INTO rides_driver_availability (
              driver_id, is_available, updated_at
            )
            VALUES ($1, TRUE, NOW())
            ON CONFLICT (driver_id)
            DO UPDATE SET
              is_available = TRUE,
              updated_at = NOW()
            RETURNING *;
          `,
          values: [driverId],
        })) as any[];

        // Localização inicial
        await trx.query({
          text: `
            INSERT INTO rides_driver_locations (
              driver_id, location, updated_at
            )
            VALUES ($1, ST_Point($2, $3), NOW())
            ON CONFLICT (driver_id)
            DO UPDATE SET
              location = ST_Point($2, $3),
              updated_at = NOW();
          `,
          values: [driverId, lng, lat],
        });

        return {
          driver_id: driverId,
          session,
          availability,
          driving_limit: limit,
        };
      });

      return result;
    }
  );

  // ============================================================
  // POST /availability/offline
  // ============================================================
  fastify.post(
    '/offline',
    {
      preHandler: [fastify.requirePermission(['rides:availability:write'])],
    },
    async (req: FastifyRequest, _reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const result = await runTenantTransaction(tenantId, async (trx) => {
        const [driver] = (await trx.query({
          text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE user_id = $1
            LIMIT 1;
          `,
          values: [userId],
        })) as Array<{ driver_id: string }>;

        if (!driver) throw new NotFoundError('Driver profile not found');
        const driverId = driver.driver_id;

        // Finalizar sessão ativa
        await trx.query({
          text: `
            UPDATE rides_driver_sessions
            SET endedAt = NOW()
            WHERE driver_id = $1
              AND endedAt IS NULL;
          `,
          values: [driverId],
        });

        // Availability = FALSE
        const [availability] = (await trx.query({
          text: `
            UPDATE rides_driver_availability
            SET is_available = FALSE, updated_at = NOW()
            WHERE driver_id = $1
            RETURNING *;
          `,
          values: [driverId],
        })) as any[];

        return { driver_id: driverId, availability };
      });

      return result;
    }
  );

  // ============================================================
  // PATCH /availability/location — heartbeat
  // ============================================================
  fastify.patch<{ Body: LocationBody }>(
    '/location',
    {
      preHandler: [fastify.requirePermission(['rides:availability:write'])],
    },
    async (
      req: FastifyRequest<{ Body: LocationBody }>,
      _reply: FastifyReply
    ) => {

      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const { lat, lng } = req.body;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestError('lat and lng required');
      }

      const out = await runTenantTransaction(tenantId, async (trx) => {
        const [driver] = (await trx.query({
          text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE user_id = $1
            LIMIT 1;
          `,
          values: [userId],
        })) as Array<{ driver_id: string }>;

        if (!driver) throw new NotFoundError('Driver profile not found');
        const driverId = driver.driver_id;

        // Atualizar localização
        await trx.query({
          text: `
            INSERT INTO rides_driver_locations (
              driver_id, location, updated_at
            )
            VALUES ($1, ST_Point($2, $3), NOW())
            ON CONFLICT (driver_id)
            DO UPDATE SET
              location = ST_Point($2, $3),
              updated_at = NOW();
          `,
          values: [driverId, lng, lat],
        });

        // Earnings + driving stats
        const [earnings] = (await trx.query({
          text: `
            SELECT *
            FROM rides_calculate_realtime_earnings($1, $2);
          `,
          values: [tenantId, driverId],
        })) as any[];

        return {
          driver_id: driverId,
          updated_location: { lat, lng },
          earnings,
        };
      });

      return out;
    }
  );

  // ============================================================
  // GET /availability/status
  // ============================================================
  fastify.get(
    '/status',
    {
      preHandler: [fastify.requirePermission(['rides:availability:read'])],
    },
    async (req: FastifyRequest, _reply: FastifyReply) => {
    const tenantId = req.tenant?.id;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      throw fastify.httpErrors.unauthorized('Authentication required');
    }

    const row = await runQueryWithTenant<{
      availability: any;
      active_session: any;
      earnings: any;
    }>(tenantId, {
      text: `
        WITH d AS (
          SELECT driver_id
          FROM rides_drivers
          WHERE user_id = $1
          LIMIT 1
        ),
        avail AS (
          SELECT *
          FROM rides_driver_availability
          WHERE driver_id = (SELECT driver_id FROM d)
        ),
        session AS (
          SELECT *
          FROM rides_driver_sessions
          WHERE driver_id = (SELECT driver_id FROM d)
          ORDER BY startedAt DESC
          LIMIT 1
        ),
        earnings AS (
          SELECT *
          FROM rides_calculate_realtime_earnings($2, (SELECT driver_id FROM d))
        )
        SELECT
          (SELECT * FROM avail) AS availability,
          (SELECT * FROM session) AS active_session,
          (SELECT * FROM earnings) AS earnings;
      `,
      values: [userId, tenantId],
    });

    return row;
  });
};

export default availabilityRoutes;

