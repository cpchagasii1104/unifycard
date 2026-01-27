// src/modules/rides/matching/matching.routes.ts
//
// Rotas Fastify para Matching no módulo Rides

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransaction } from '@core/db';
import { BadRequestError, NotFoundError } from '@core/errors';

interface NearbyDriversQuery {
  lat: string;
  lng: string;
  radius_km?: string;
  service_type_id?: string;
  min_capacity?: string;
}

interface AutoAssignBody {
  rideRequestId: string;
  origin: { lat: number; lng: number };
  serviceTypeId?: string;
  minCapacity?: number;
  radiusKm?: number;
}

interface OfferParams {
  offerId: string;
  rideRequestId?: string;
}

const matchingRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // GET /nearby-drivers — procura motoristas próximos
  // =====================================================================
  fastify.get<{ Querystring: NearbyDriversQuery }>(
    '/nearby-drivers',
    {
      preHandler: [fastify.requirePermission(['rides:matching:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radiusKm = Number(req.query.radius_km ?? 5);
      const serviceTypeId = req.query.service_type_id
        ? String(req.query.service_type_id)
        : null;
      const minCapacity = Number(req.query.min_capacity ?? 1);

      if (!lat || !lng) {
        throw new BadRequestError('lat and lng are required');
      }

      const drivers = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT *
          FROM rides_find_nearby_drivers(
            $1::text,
            $2, $3,
            $4,
            $5::text,
            $6,
            $7
          );
        `,
        values: [
          tenantId,
          lat,
          lng,
          radiusKm,
          serviceTypeId,
          minCapacity,
          20, // LIMIT default
        ],
      });

      return drivers;
    }
  );

  // =====================================================================
  // POST /auto-assign — matching automático instantâneo
  // =====================================================================
  fastify.post<{ Body: AutoAssignBody }>(
    '/auto-assign',
    {
      preHandler: [fastify.requirePermission(['rides:matching:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const {
        rideRequestId,
        origin,
        serviceTypeId,
        minCapacity,
        radiusKm,
      } = req.body;

      if (!rideRequestId) {
        throw new BadRequestError('rideRequestId required');
      }
      if (!origin?.lat || !origin?.lng) {
        throw new BadRequestError('origin.lat and origin.lng required');
      }

      const drivers = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT *
          FROM rides_find_nearby_drivers(
            $1::text,
            $2,
            $3,
            $4,
            $5::text,
            $6,
            20
          );
        `,
        values: [
          tenantId,
          origin.lat,
          origin.lng,
          radiusKm ?? 5,
          serviceTypeId ?? null,
          minCapacity ?? 1,
        ],
      });

      if (drivers.length === 0) {
        return {
          assigned: false,
          driver: null,
        };
      }

      const bestDriver = drivers[0];

      // Criar offer
      const offer = await runTenantTransaction(tenantId, async (trx) => {
        const offerRows = await trx.query({
          text: `
            INSERT INTO rides_ride_offers (
              tenant_id,
              ride_request_id,
              driver_id,
              status,
              sent_at
            )
            VALUES ($1, $2, $3, 'sent', NOW())
            RETURNING *;
          `,
          values: [tenantId, rideRequestId, bestDriver.driver_id],
        });

        return offerRows[0];
      });

      return {
        assigned: true,
        driver: bestDriver,
        offer,
      };
    }
  );

  // =====================================================================
  // POST /offers/:offerId/accept — motorista aceita a corrida
  // =====================================================================
  fastify.post<{ Params: OfferParams }>(
    '/offers/:offerId/accept',
    {
      preHandler: [fastify.requirePermission(['rides:matching:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { offerId } = req.params;

      const offer = await runTenantTransaction(tenantId, async (trx) => {
        // Buscar driver_id do usuário
        const driverRows = await trx.query({
          text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE tenant_id = $1 AND user_id = $2
            LIMIT 1;
          `,
          values: [tenantId, userId],
        });

        if (driverRows.length === 0) {
          throw new NotFoundError('Driver profile not found');
        }

        const driverId = driverRows[0].driver_id;

        const rows = await trx.query({
          text: `
            UPDATE rides_ride_offers
            SET status = 'accepted', responded_at = NOW()
            WHERE tenant_id = $1 AND offer_id = $2
              AND driver_id = $3
            RETURNING *;
          `,
          values: [tenantId, offerId, driverId],
        });

        if (rows.length === 0) {
          throw new NotFoundError('Offer not found for this driver');
        }

        return rows[0];
      });

      return offer;
    }
  );

  // =====================================================================
  // POST /offers/:offerId/reject — rejeição pelo motorista
  // =====================================================================
  fastify.post<{ Params: OfferParams }>(
    '/offers/:offerId/reject',
    {
      preHandler: [fastify.requirePermission(['rides:matching:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId || !userId) throw new BadRequestError('Missing tenant or user context');

      const { offerId } = req.params;

      const offer = await runTenantTransaction(tenantId, async (trx) => {
        // Buscar driver_id do usuário
        const driverRows = await trx.query({
          text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE tenant_id = $1 AND user_id = $2
            LIMIT 1;
          `,
          values: [tenantId, userId],
        });

        if (driverRows.length === 0) {
          throw new NotFoundError('Driver profile not found');
        }

        const driverId = driverRows[0].driver_id;

        const rows = await trx.query({
          text: `
            UPDATE rides_ride_offers
            SET status = 'rejected', responded_at = NOW()
            WHERE tenant_id = $1 AND offer_id = $2
              AND driver_id = $3
            RETURNING *;
          `,
          values: [tenantId, offerId, driverId],
        });

        if (rows.length === 0) {
          throw new NotFoundError('Offer not found for this driver');
        }

        return rows[0];
      });

      return offer;
    }
  );

  // =====================================================================
  // GET /offers/:rideRequestId — lista ofertas enviadas para um request
  // =====================================================================
  fastify.get<{ Params: OfferParams }>(
    '/offers/:rideRequestId',
    {
      preHandler: [fastify.requirePermission(['rides:matching:read'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { rideRequestId } = req.params;
      const offers = await runQueriesWithTenant<any>(tenantId, {
        text: `
          SELECT *
          FROM rides_ride_offers
          WHERE tenant_id = $1 AND ride_request_id = $2
          ORDER BY sent_at DESC;
        `,
        values: [tenantId, rideRequestId],
      });

      return offers;
    }
  );
};

export default matchingRoutes;
