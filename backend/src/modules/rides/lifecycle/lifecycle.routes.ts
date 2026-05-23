// src/modules/rides/lifecycle/lifecycle.routes.ts
//
// Lifecycle oficial da corrida - Fastify Plugin

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from '@core/db';
import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
import { notifyService } from '@core/notify/notify.service';
import { pricingService } from '../pricing/pricing.service';
import { distributionService } from '../distribution/distribution.service';
import { publishRideEventOutbox } from '../shared/publish-ride-event';
import { assertRideAuthority } from '../shared/ride-authority';

interface RequestBody {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  serviceTypeId?: string;
  stops?: Array<{ lat: number; lng: number }>;
}

interface AssignBody {
  rideRequestId: string;
  driverId: string;
  vehicleId?: string;
}

interface ArrivingBody {
  rideId: string;
  etaMinutes?: number;
}

interface StartBody {
  rideId: string;
}

interface StopBody {
  rideId: string;
  lat: number;
  lng: number;
}

interface CompleteBody {
  rideId: string;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  waitTimeSeconds?: number;
  tipAmount?: number;
}

interface CancelBody {
  rideId: string;
  reason?: string;
}

const lifecycleRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // =====================================================================
  // POST /request → criar request de corrida
  // =====================================================================
  fastify.post<{ Body: RequestBody }>(
    '/request',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const passengerId = req.user?.id;

      if (!tenantId || !passengerId) {
        throw new BadRequestError('Missing tenant or user context');
      }

      await assertRideAuthority(req, tenantId, passengerId, 'request_ride');

      const {
        origin,
        destination,
        serviceTypeId,
        stops,
      } = req.body;

      if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
        throw new BadRequestError('origin and destination required');
      }

      const request = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows } = await client.query(
          `
            INSERT INTO rides_ride_requests (
              tenant_id,
              passenger_user_id,
              origin,
              destination,
              service_type_id,
              status,
              created_at
            )
            VALUES (
              $1,
              $2,
              ST_Point($3, $4),
              ST_Point($5, $6),
              $7,
              'requested',
              NOW()
            )
            RETURNING *;
          `,
          [
            tenantId,
            passengerId,
            origin.lng, origin.lat,
            destination.lng, destination.lat,
            serviceTypeId ?? null,
          ]
        );

        if (stops && stops.length > 0) {
          for (let i = 0; i < stops.length; i++) {
            await client.query(
              `
                INSERT INTO rides_ride_stops (
                  ride_request_id,
                  stop_order,
                  location
                )
                VALUES ($1, $2, ST_Point($3, $4));
              `,
              [
                rows[0].ride_request_id,
                i + 1,
                stops[i].lng,
                stops[i].lat,
              ]
            );
          }
        }

        await publishRideEventOutbox(client, {
          type: 'rides.request.created',
          tenantId,
          payload: {
            rideRequestId: rows[0].ride_request_id,
            passengerId,
            origin,
            destination,
          },
        });

        return rows[0];
      });

      reply.code(201);
      return request;
    }
  );

  // =====================================================================
  // POST /assign → criar ride a partir do offer aceito
  // =====================================================================
  fastify.post<{ Body: AssignBody }>(
    '/assign',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;
      if (!tenantId) throw new BadRequestError('Missing tenant context');
      if (!userId) throw new BadRequestError('Missing user context');

      const { rideRequestId, driverId, vehicleId } = req.body;

      if (!rideRequestId || !driverId) {
        throw new BadRequestError('rideRequestId and driverId required');
      }

      await assertRideAuthority(req, tenantId, userId, 'manage_ride', rideRequestId);

      const ride = await runTenantTransactionWithClient(tenantId, async (client) => {
        await client.query(
          `
            UPDATE rides_ride_requests
            SET status = 'driver_assigned'
            WHERE tenant_id = $1 AND ride_request_id = $2;
          `,
          [tenantId, rideRequestId]
        );

        const { rows } = await client.query(
          `
            INSERT INTO rides_rides (
              tenant_id,
              ride_request_id,
              driver_id,
              vehicle_id,
              passenger_user_id,
              status,
              created_at
            )
            SELECT
              $1,
              rr.ride_request_id,
              $2,
              $3,
              rr.passenger_user_id,
              'driver_assigned',
              NOW()
            FROM rides_ride_requests rr
            WHERE rr.tenant_id = $1 AND rr.ride_request_id = $4
            RETURNING *;
          `,
          [tenantId, driverId, vehicleId ?? null, rideRequestId]
        );

        await publishRideEventOutbox(client, {
          type: 'rides.ride.driver_assigned',
          tenantId,
          payload: {
            rideId: rows[0].ride_id,
            driverId,
          },
        });

        return rows[0];
      });

      return ride;
    }
  );

  // =====================================================================
  // POST /arriving → motorista chegando
  // =====================================================================
  fastify.post<{ Body: ArrivingBody }>(
    '/arriving',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const driverUserId = req.user?.id;

      if (!tenantId || !driverUserId) {
        throw new BadRequestError('Missing tenant or user context');
      }

      const { rideId, etaMinutes } = req.body;

      await assertRideAuthority(req, tenantId, driverUserId, 'manage_ride', rideId);

      const ride = await runQueryWithTenant<any>(tenantId, {
        text: `
          SELECT r.*, d.user_id AS driver_user_id
          FROM rides_rides r
          JOIN rides_drivers d ON d.driver_id = r.driver_id
          WHERE r.tenant_id = $1 AND r.ride_id = $2
        `,
        values: [tenantId, rideId],
      });

      if (!ride) throw new NotFoundError('Ride not found');
      if (ride.driver_user_id !== driverUserId) {
        throw new ConflictError('Not authorized for this ride');
      }

      await runTenantTransactionWithClient(tenantId, async (client) => {
        await client.query(
          `
          INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
          VALUES ($1, 'driver_arriving', jsonb_build_object('eta', $2), NOW());
        `,
          [rideId, etaMinutes ?? null]
        );
        await publishRideEventOutbox(client, {
          type: 'rides.ride.driver_arriving',
          tenantId,
          payload: { rideId, etaMinutes },
        });
      });

      return { status: 'ok' };
    }
  );

  // =====================================================================
  // POST /start → iniciar corrida
  // =====================================================================
  fastify.post<{ Body: StartBody }>(
    '/start',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const driverUserId = req.user?.id;

      if (!tenantId || !driverUserId) {
        throw new BadRequestError('Missing tenant or user context');
      }

      const { rideId } = req.body;

      await assertRideAuthority(req, tenantId, driverUserId, 'manage_ride', rideId);

      const ride = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows } = await client.query(
          `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2
            LIMIT 1;
          `,
          [tenantId, rideId]
        );

        if (rows.length === 0) throw new NotFoundError('Ride not found');

        const rideRow = rows[0];

        if (rideRow.driver_user_id !== driverUserId) {
          throw new ConflictError('Unauthorized driver');
        }

        await client.query(
          `
            UPDATE rides_rides
            SET status = 'started',
                startedAt = NOW()
            WHERE tenant_id = $1 AND ride_id = $2;
          `,
          [tenantId, rideId]
        );

        await client.query(
          `
            INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
            VALUES ($1, 'ride_started', NOW());
          `,
          [rideId]
        );

        await publishRideEventOutbox(client, {
          type: 'rides.ride.started',
          tenantId,
          payload: { rideId },
        });

        return rideRow;
      });

      return { rideId, status: 'started' };
    }
  );

  // =====================================================================
  // POST /stop → motorista marca uma parada
  // =====================================================================
  fastify.post<{ Body: StopBody }>(
    '/stop',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const driverUserId = req.user?.id;

      if (!tenantId || !driverUserId) {
        throw new BadRequestError('Missing tenant or user context');
      }

      const { rideId, lat, lng } = req.body;

      await assertRideAuthority(req, tenantId, driverUserId, 'manage_ride', rideId);

      const result = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows: rideRows } = await client.query(
          `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2;
          `,
          [tenantId, rideId]
        );
        const ride = rideRows[0];

        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.driver_user_id !== driverUserId) {
          throw new ConflictError('Not allowed');
        }

        await client.query(
          `
            INSERT INTO rides_ride_stops (
              ride_id,
              stop_order,
              location
            )
            VALUES (
              $1,
              (SELECT COALESCE(MAX(stop_order), 0) + 1 FROM rides_ride_stops WHERE ride_id = $1),
              ST_Point($2, $3)
            );
          `,
          [rideId, lng, lat]
        );

        await client.query(
          `
            INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
            VALUES ($1, 'stop_added', jsonb_build_object('lat', $2, 'lng', $3), NOW());
          `,
          [rideId, lat, lng]
        );

        return { rideId };
      });

      return result;
    }
  );

  // =====================================================================
  // POST /complete → finalizar corrida
  // =====================================================================
  fastify.post<{ Body: CompleteBody }>(
    '/complete',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const driverUserId = req.user?.id;

      if (!tenantId || !driverUserId) {
        throw new BadRequestError('Missing tenant or user context');
      }

      const {
        rideId,
        totalDistanceKm,
        totalDurationMinutes,
        waitTimeSeconds,
        tipAmount,
      } = req.body;

      await assertRideAuthority(req, tenantId, driverUserId, 'manage_ride', rideId);

      const { ride, pricing } = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows: foundRows } = await client.query(
          `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2;
          `,
          [tenantId, rideId]
        );
        const found = foundRows[0];

        if (!found) throw new NotFoundError('Ride not found');
        if (found.driver_user_id !== driverUserId) {
          throw new ConflictError('Unauthorized');
        }

        const pricingResult = await pricingService.calculateFinalPrice(tenantId, rideId, {
          skipEmit: true,
        });

        const { rows: updatedRows } = await client.query(
          `
            UPDATE rides_rides
            SET status = 'completed',
                completedAt = NOW(),
                final_price = $2,
                total_distance_km = $3,
                total_duration_minutes = $4,
                wait_time_seconds = $5,
                tip_amount = $6
            WHERE tenant_id = $1 AND ride_id = $7
            RETURNING *;
          `,
          [
            tenantId,
            pricingResult.totalCents,
            totalDistanceKm,
            totalDurationMinutes,
            waitTimeSeconds ?? null,
            tipAmount ?? 0,
            rideId,
          ]
        );
        const updated = updatedRows[0];

        await client.query(
          `
            INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
            VALUES ($1, 'ride_completed', NOW());
          `,
          [rideId]
        );

        await publishRideEventOutbox(client, {
          type: 'rides.pricing.calculated',
          tenantId,
          payload: {
            rideId,
            finalPrice: pricingResult,
          },
        });

        await publishRideEventOutbox(client, {
          type: 'rides.ride.completed',
          tenantId,
          payload: {
            rideId,
            driverId: updated.driver_id,
            passengerId: updated.passenger_user_id,
            finalPrice: updated.final_price,
          },
        });

        return { ride: updated, pricing: pricingResult };
      });

      await distributionService.processRidePayment(tenantId, ride, {
        totalCents: ride.final_price ?? 0,
      });

      // notificação
      await notifyService.send({
        tenantId,
        channel: 'push',
        userId: ride.passenger_user_id,
        templateName: 'ride_completed',
        payload: { rideId, amountCents: ride.final_price },
      });

      return { rideId, status: 'completed' };
    }
  );

  // =====================================================================
  // POST /cancel — cancelamento por passageiro ou motorista
  // =====================================================================
  fastify.post<{ Body: CancelBody }>(
    '/cancel',
    {
      preHandler: [fastify.requirePermission(['rides:lifecycle:write'])],
    },
    async (req, reply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw new BadRequestError('Missing tenant or user context');
      }

      const { rideId, reason } = req.body;

      await assertRideAuthority(req, tenantId, userId, 'manage_ride', rideId);

      const ride = await runTenantTransactionWithClient(tenantId, async (client) => {
        const { rows: foundRows } = await client.query(
          `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2;
          `,
          [tenantId, rideId]
        );

        const found = foundRows[0];
        if (!found) throw new NotFoundError('Ride not found');

        let cancelledBy: 'driver' | 'passenger';
        if (found.driver_user_id === userId) cancelledBy = 'driver';
        else if (found.passenger_user_id === userId) cancelledBy = 'passenger';
        else throw new ConflictError('Unauthorized cancellation');

        await client.query(
          `
            UPDATE rides_rides
            SET status = 'cancelled',
                cancelledAt = NOW(),
                cancellation_reason = $2,
                cancelled_by = $3
            WHERE tenant_id = $1 AND ride_id = $4;
          `,
          [tenantId, reason ?? null, cancelledBy, rideId]
        );

        await client.query(
          `
            INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
            VALUES ($1, 'ride_cancelled', jsonb_build_object('reason',$2,'by',$3), NOW());
          `,
          [rideId, reason ?? null, cancelledBy]
        );

        const payload = { rideId, cancelledBy };

        await publishRideEventOutbox(client, {
          type: 'rides.ride.cancelled',
          tenantId,
          payload,
        });

        return payload;
      });

      return ride;
    }
  );
};

export default lifecycleRoutes;


