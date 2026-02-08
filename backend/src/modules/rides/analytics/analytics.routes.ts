// src/modules/rides/analytics/analytics.routes.ts
//
// Rides Analytics – versão Fastify 100% compatível com Unificard v1
//

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant } from '@core/db';
import { NotFoundError } from '@core/errors';

const analyticsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {



  // ===========================================================================
  // GET /analytics/driver/overview
  // ===========================================================================

  fastify.get(
    '/driver/overview',
    async (
      req: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // Buscar driver_id
      const [driver] = await runQueryWithTenant(tenantId, {
        text: `
          SELECT driver_id
          FROM rides_drivers
          WHERE user_id = $1
          LIMIT 1;
        `,
        values: [userId],
      });

      if (!driver) throw new NotFoundError('Driver profile not found');

      const driverId = driver.driver_id;

      const [overview] = await runQueryWithTenant(tenantId, {
        text: `
          WITH rides_today AS (
            SELECT COUNT(*) AS total
            FROM rides_rides
            WHERE driver_id = $1
              AND status = 'completed'
              AND completedAt::date = NOW()::date
          ),
          earnings_today AS (
            SELECT COALESCE(SUM(driver_amount), 0) AS amount
            FROM rides_ride_distributions
            WHERE ride_id IN (
              SELECT ride_id FROM rides_rides WHERE driver_id = $1
            )
            AND distributedAt::date = NOW()::date
          ),
          rating AS (
            SELECT rating_avg, total_rides
            FROM rides_drivers
            WHERE driver_id = $1
          )
          SELECT
            (SELECT total FROM rides_today) AS rides_today,
            (SELECT amount FROM earnings_today) AS earnings_today,
            rating.rating_avg,
            rating.total_rides
          FROM rating;
        `,
        values: [driverId],
      });

      return overview;
    }
  );



  // ===========================================================================
  // GET /analytics/driver/hourly-earnings
  // ===========================================================================

  fastify.get(
    '/driver/hourly-earnings',
    async (
      req: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      // descobre driver
      const [driver] = await runQueryWithTenant(tenantId, {
        text: `
          SELECT driver_id
          FROM rides_drivers
          WHERE user_id = $1
          LIMIT 1;
        `,
        values: [userId],
      });

      if (!driver) throw new NotFoundError('Driver profile not found');
      const driverId = driver.driver_id;

      const rows = await runQueryWithTenant(tenantId, {
        text: `
          SELECT
            DATE_TRUNC('hour', distributedAt) AS hour,
            SUM(driver_amount) AS earnings
          FROM rides_ride_distributions
          WHERE ride_id IN (
            SELECT ride_id FROM rides_rides WHERE driver_id = $1
          )
            AND distributedAt > NOW() - INTERVAL '24 hours'
          GROUP BY hour
          ORDER BY hour ASC;
        `,
        values: [driverId],
      });

      return rows;
    }
  );



  // ===========================================================================
  // GET /analytics/city/demand
  // ===========================================================================

  fastify.get(
    '/city/demand',
    async (
      req: FastifyRequest<{
        Querystring: { cityId?: string }
      }>,
      reply: FastifyReply
    ) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const { cityId } = req.query;

      const rows = await runQueryWithTenant(tenantId, {
        text: `
          SELECT
            z.zone_id,
            z.name,
            z.city_id,
            dp.pressure,
            dp.level,
            dp.active_requests,
            dp.available_drivers,
            dp.calculatedAt
          FROM rides_zones z
          LEFT JOIN rides_zone_demand_pressure dp
            ON dp.zone_id = z.zone_id
          WHERE ($1::text IS NULL OR z.city_id::text = $1)
          ORDER BY dp.level DESC NULLS LAST;
        `,
        values: [cityId ?? null],
      });

      return rows;
    }
  );



  // ===========================================================================
  // GET /analytics/city/activity
  // ===========================================================================

  fastify.get(
    '/city/activity',
    async (
      req: FastifyRequest<{
        Querystring: { cityId?: string }
      }>,
      reply: FastifyReply
    ) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const { cityId } = req.query;

      const [activity] = await runQueryWithTenant(tenantId, {
        text: `
          WITH rides_today AS (
            SELECT COUNT(*) AS total
            FROM rides_rides
            WHERE status = 'completed'
              AND completedAt::date = NOW()::date
              AND ($1::text IS NULL OR city_id::text = $1)
          ),
          cancellations AS (
            SELECT COUNT(*) AS total
            FROM rides_rides
            WHERE status = 'cancelled'
              AND cancelledAt::date = NOW()::date
              AND ($1::text IS NULL OR city_id::text = $1)
          ),
          avg_duration AS (
            SELECT COALESCE(AVG(total_duration_minutes), 0) AS avg_minutes
            FROM rides_rides
            WHERE status = 'completed'
              AND completedAt > NOW() - INTERVAL '24 hours'
              AND ($1::text IS NULL OR city_id::text = $1)
          ),
          drivers_online AS (
            SELECT COUNT(*) AS total
            FROM rides_driver_availability
            WHERE is_available = TRUE
          ),
          surge_usage AS (
            SELECT COUNT(*) AS total
            FROM rides_surge_multipliers
            WHERE active_until IS NULL OR active_until > NOW()
          )
          SELECT
            (SELECT total FROM rides_today) AS rides_today,
            (SELECT total FROM cancellations) AS cancellations,
            (SELECT avg_minutes FROM avg_duration) AS avg_duration_minutes,
            (SELECT total FROM drivers_online) AS drivers_online,
            (SELECT total FROM surge_usage) AS surge_rules_active;
        `,
        values: [cityId ?? null],
      });

      return activity;
    }
  );



  // ===========================================================================
  // GET /analytics/rides/summary
  // ===========================================================================

  fastify.get(
    '/rides/summary',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const rows = await runQueryWithTenant(tenantId, {
        text: `
          WITH dates AS (
            SELECT generate_series(
              NOW()::date - INTERVAL '6 days',
              NOW()::date,
              INTERVAL '1 day'
            )::date AS day
          ),
          rides_per_day AS (
            SELECT
              completedAt::date AS day,
              COUNT(*) AS rides
            FROM rides_rides
            WHERE status = 'completed'
              AND completedAt > NOW() - INTERVAL '7 days'
            GROUP BY day
          ),
          revenue AS (
            SELECT
              distributedAt::date AS day,
              SUM(driver_amount + platform_fee + community_fee) AS revenue
            FROM rides_ride_distributions
            WHERE distributedAt > NOW() - INTERVAL '7 days'
            GROUP BY day
          ),
          rating AS (
            SELECT
              r.completedAt::date AS day,
              AVG(COALESCE(r.driver_rating, r.passenger_rating)) AS avg_rating
            FROM rides_rides r
            WHERE r.completedAt > NOW() - INTERVAL '7 days'
            GROUP BY day
          )
          SELECT
            d.day,
            COALESCE(rp.rides, 0) AS rides,
            COALESCE(rv.revenue, 0) AS revenue,
            COALESCE(rt.avg_rating, 5.0) AS avg_rating
          FROM dates d
          LEFT JOIN rides_per_day rp ON rp.day = d.day
          LEFT JOIN revenue rv ON rv.day = d.day
          LEFT JOIN rating rt ON rt.day = d.day
          ORDER BY d.day ASC;
        `,
      });

      return rows;
    }
  );

};

export default analyticsRoutes;

