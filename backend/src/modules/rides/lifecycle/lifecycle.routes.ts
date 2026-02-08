// src/modules/rides/lifecycle/lifecycle.routes.ts
//
// Lifecycle oficial da corrida - Fastify Plugin

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply
} from 'fastify';

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransaction } from '@core/db';
import { BadRequestError, NotFoundError, ConflictError } from '@core/errors';
import { eventBus } from '@core/events/event-bus';
import { notifyService } from '@core/notify/notify.service';
import { pricingService } from '../pricing/pricing.service';
import { processRidePayment } from '../shared/payment';

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

      const {
        origin,
        destination,
        serviceTypeId,
        stops,
      } = req.body;

      if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
        throw new BadRequestError('origin and destination required');
      }

      const request = await runTenantTransaction(tenantId, async (trx) => {
        const rows = await trx.query({
          text: `
            INSERT INTO rides_ride_requests (
              tenant_id,
              passenger_user_id,
              origin,
              destination,
              service_type_id,
              status,
              createdAt
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
          values: [
            tenantId,
            passengerId,
            origin.lng, origin.lat,
            destination.lng, destination.lat,
            serviceTypeId ?? null,
          ],
        });

        // Stops opcional
        if (stops && stops.length > 0) {
          for (let i = 0; i < stops.length; i++) {
            await trx.query({
              text: `
                INSERT INTO rides_ride_stops (
                  ride_request_id,
                  stop_order,
                  location
                )
                VALUES ($1, $2, ST_Point($3, $4));
              `,
              values: [
                rows[0].ride_request_id,
                i + 1,
                stops[i].lng,
                stops[i].lat,
              ],
            });
          }
        }

        return rows[0];
      });

      // Evento
      await eventBus.emit({
        type: 'rides.request.created',
        tenantId,
        payload: {
          rideRequestId: request.ride_request_id,
          passengerId,
          origin,
          destination,
        },
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
      if (!tenantId) throw new BadRequestError('Missing tenant context');

      const { rideRequestId, driverId, vehicleId } = req.body;

      if (!rideRequestId || !driverId) {
        throw new BadRequestError('rideRequestId and driverId required');
      }

      const ride = await runTenantTransaction(tenantId, async (trx) => {
        // marcar request como assigned
        await trx.query({
          text: `
            UPDATE rides_ride_requests
            SET status = 'driver_assigned'
            WHERE tenant_id = $1 AND ride_request_id = $2;
          `,
          values: [tenantId, rideRequestId],
        });

        // criar ride
        const rows = await trx.query({
          text: `
            INSERT INTO rides_rides (
              tenant_id,
              ride_request_id,
              driver_id,
              vehicle_id,
              passenger_user_id,
              status,
              createdAt
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
          values: [tenantId, driverId, vehicleId ?? null, rideRequestId],
        });

        return rows[0];
      });

      await eventBus.emit({
        type: 'rides.ride.driver_assigned',
        tenantId,
        payload: {
          rideId: ride.ride_id,
          driverId,
        },
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

      await runQueryWithTenant(tenantId, {
        text: `
          INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
          VALUES ($1, 'driver_arriving', jsonb_build_object('eta', $2), NOW());
        `,
        values: [rideId, etaMinutes ?? null],
      });

      await eventBus.emit({
        type: 'rides.ride.driver_arriving',
        tenantId,
        payload: { rideId, etaMinutes },
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

      const ride = await runTenantTransaction(tenantId, async (trx) => {
        // validar motorista
        const rows = await trx.query({
          text: `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2
            LIMIT 1;
          `,
          values: [tenantId, rideId],
        });

        if (rows.length === 0) throw new NotFoundError('Ride not found');

        const ride = rows[0];

        if (ride.driver_user_id !== driverUserId) {
          throw new ConflictError('Unauthorized driver');
        }

        // atualizar estado
        await trx.query({
          text: `
            UPDATE rides_rides
            SET status = 'started',
                startedAt = NOW()
            WHERE tenant_id = $1 AND ride_id = $2;
          `,
          values: [tenantId, rideId],
        });

        // registrar evento
        await trx.query({
          text: `
            INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
            VALUES ($1, 'ride_started', NOW());
          `,
          values: [rideId],
        });

        return ride;
      });

      await eventBus.emit({
        type: 'rides.ride.started',
        tenantId,
        payload: { rideId },
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

      const result = await runTenantTransaction(tenantId, async (trx) => {
        const [ride] = await trx.query({
          text: `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2;
          `,
          values: [tenantId, rideId],
        });

        if (!ride) throw new NotFoundError('Ride not found');
        if (ride.driver_user_id !== driverUserId) {
          throw new ConflictError('Not allowed');
        }

        await trx.query({
          text: `
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
          values: [rideId, lng, lat],
        });

        await trx.query({
          text: `
            INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
            VALUES ($1, 'stop_added', jsonb_build_object('lat', $2, 'lng', $3), NOW());
          `,
          values: [rideId, lat, lng],
        });

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

      const ride = await runTenantTransaction(tenantId, async (trx) => {
        // buscar ride + validar motorista
        const [found] = await trx.query({
          text: `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2;
          `,
          values: [tenantId, rideId],
        });

        if (!found) throw new NotFoundError('Ride not found');
        if (found.driver_user_id !== driverUserId) {
          throw new ConflictError('Unauthorized');
        }

        // calcular preço (com engine real no service)
        const pricing = await pricingService.calculateFinalPrice(tenantId, rideId);

        // atualizar ride
        const [updated] = await trx.query({
          text: `
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
          values: [
            tenantId,
            pricing.total,
            totalDistanceKm,
            totalDurationMinutes,
            waitTimeSeconds ?? null,
            tipAmount ?? 0,
            rideId,
          ],
        });

        // inserir evento
        await trx.query({
          text: `
            INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
            VALUES ($1, 'ride_completed', NOW());
          `,
          values: [rideId],
        });

        return updated;
      });

      // pagamento (ECONOMY)
      await processRidePayment({
        tenantId,
        rideId,
        passengerId: ride.passenger_user_id,
        driverId: ride.driver_id,
        totalAmount: ride.final_price,
        platformFeePercent: ride.platform_fee_percent ?? 15,
        communityFeePercent: ride.community_fee_percent ?? 2,
        driverIncentives: ride.incentives ?? 0,
        tipAmount: tipAmount ?? 0,
      });

      // eventos
      await eventBus.emit({
        type: 'rides.ride.completed',
        tenantId,
        payload: {
          rideId,
          driverId: ride.driver_id,
          passengerId: ride.passenger_user_id,
          finalPrice: ride.final_price,
        },
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

      const ride = await runTenantTransaction(tenantId, async (trx) => {
        const foundRows = await trx.query({
          text: `
            SELECT r.*, d.user_id AS driver_user_id
            FROM rides_rides r
            JOIN rides_drivers d ON d.driver_id = r.driver_id
            WHERE r.tenant_id = $1 AND r.ride_id = $2;
          `,
          values: [tenantId, rideId],
        });

        const found = foundRows[0];
        if (!found) throw new NotFoundError('Ride not found');

        let cancelledBy: 'driver' | 'passenger';
        if (found.driver_user_id === userId) cancelledBy = 'driver';
        else if (found.passenger_user_id === userId) cancelledBy = 'passenger';
        else throw new ConflictError('Unauthorized cancellation');

        await trx.query({
          text: `
            UPDATE rides_rides
            SET status = 'cancelled',
                cancelledAt = NOW(),
                cancellation_reason = $2,
                cancelled_by = $3
            WHERE tenant_id = $1 AND ride_id = $4;
          `,
          values: [tenantId, reason ?? null, cancelledBy, rideId],
        });

        await trx.query({
          text: `
            INSERT INTO rides_ride_events (ride_id, event_type, payload, occurredAt)
            VALUES ($1, 'ride_cancelled', jsonb_build_object('reason',$2,'by',$3), NOW());
          `,
          values: [rideId, reason ?? null, cancelledBy],
        });

        return { rideId, cancelledBy };
      });

      // evento de reputação
      await eventBus.emit({
        type: 'rides.ride.cancelled',
        tenantId,
        payload: ride,
      });

      return ride;
    }
  );
};

export default lifecycleRoutes;


