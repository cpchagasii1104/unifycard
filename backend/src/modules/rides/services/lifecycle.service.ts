// src/modules/rides/services/lifecycle.service.ts
//
// Lógica oficial de Lifecycle do módulo Rides.

import { runTenantTransactionWithClient } from "@core/db";

import { pricingService } from "./pricing.service";
import { notifyService } from "@core/notify/notify.service";
import { distributionService } from "../distribution/distribution.service";
import { publishRideEventOutbox } from "../shared/publish-ride-event";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@core/errors";

class LifecycleService {
  async createRequest(tenantId: string, passengerId: string, data: any) {
    const {
      origin,
      destination,
      serviceTypeId,
      stops,
    } = data;

    if (!origin?.lat || !origin?.lng) {
      throw new BadRequestError("origin missing");
    }

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const { rows } = await client.query(
        `
          INSERT INTO rides_ride_requests (
            passenger_user_id,
            origin,
            destination,
            service_type_id,
            status,
            created_at
          )
          VALUES (
            $1,
            ST_Point($2, $3),
            ST_Point($4, $5),
            $6,
            'requested',
            NOW()
          )
          RETURNING *;
        `,
        [
          passengerId,
          origin.lng, origin.lat,
          destination.lng, destination.lat,
          serviceTypeId,
        ]
      );

      if (stops?.length) {
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

      const request = rows[0];

      await publishRideEventOutbox(client, {
        type: "rides.request.created",
        tenantId,
        payload: {
          rideRequestId: request.ride_request_id,
          passengerId,
        },
      });

      return request;
    });
  }

  async assignDriver(tenantId: string, data: any) {
    const { rideRequestId, driverId, vehicleId } = data;

    return runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
          UPDATE rides_ride_requests
          SET status = 'driver_assigned'
          WHERE ride_request_id = $1;
        `,
        [rideRequestId]
      );

      const { rows } = await client.query(
        `
          INSERT INTO rides_rides (
            ride_request_id,
            driver_id,
            vehicle_id,
            passenger_user_id,
            status,
            created_at
          )
          SELECT
            rr.ride_request_id,
            $2,
            $3,
            rr.passenger_user_id,
            'driver_assigned',
            NOW()
          FROM rides_ride_requests rr
          WHERE rr.ride_request_id = $1
          RETURNING *;
        `,
        [rideRequestId, driverId, vehicleId]
      );

      const ride = rows[0];

      await publishRideEventOutbox(client, {
        type: "rides.ride.driver_assigned",
        tenantId,
        payload: {
          rideId: ride.ride_id,
          driverId,
        },
      });

      return ride;
    });
  }

  async startRide(tenantId: string, rideId: string, driverUserId: string) {
    return runTenantTransactionWithClient(tenantId, async (client) => {
      const { rows: infoRows } = await client.query(
        `
          SELECT r.*, d.user_id AS driver_user_id
          FROM rides_rides r
          JOIN rides_drivers d ON d.driver_id = r.driver_id
          WHERE ride_id = $1;
        `,
        [rideId]
      );
      const info = infoRows[0];

      if (!info) throw new NotFoundError("Ride not found");
      if (info.driver_user_id !== driverUserId) {
        throw new ConflictError("Unauthorized driver");
      }

      await client.query(
        `
          UPDATE rides_rides
          SET status = 'started',
              startedAt = NOW()
          WHERE ride_id = $1;
        `,
        [rideId]
      );

      await client.query(
        `
          INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
          VALUES ($1, 'ride_started', NOW());
        `,
        [rideId]
      );

      await publishRideEventOutbox(client, {
        type: "rides.ride.started",
        tenantId,
        payload: { rideId },
      });

      return info;
    });
  }

  async completeRide(tenantId: string, driverUserId: string, data: any) {
    const {
      rideId,
      totalDistanceKm,
      totalDurationMinutes,
      waitTimeSeconds,
      tipAmount,
    } = data;

    const ride = await runTenantTransactionWithClient(tenantId, async (client) => {
      const { rows: foundRows } = await client.query(
        `
          SELECT r.*, d.user_id AS driver_user_id
          FROM rides_rides r
          JOIN rides_drivers d ON d.driver_id = r.driver_id
          WHERE ride_id = $1;
        `,
        [rideId]
      );
      const found = foundRows[0];

      if (!found) throw new NotFoundError("Ride not found");
      if (found.driver_user_id !== driverUserId) {
        throw new ConflictError("Unauthorized");
      }

      const pricing = await pricingService.calculate({
        tenantId,
        rideId,
        distanceKm: totalDistanceKm,
        durationMinutes: totalDurationMinutes,
        waitTimeSeconds,
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
          WHERE ride_id = $1
          RETURNING *;
        `,
        [
          rideId,
          pricing.totalCents,
          totalDistanceKm,
          totalDurationMinutes,
          waitTimeSeconds ?? null,
          tipAmount ?? 0,
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
        type: "rides.ride.completed",
        tenantId,
        payload: {
          rideId,
          passengerId: updated.passenger_user_id,
          driverId: updated.driver_id,
          finalPrice: updated.final_price,
        },
      });

      return updated;
    });

    await distributionService.processRidePayment(tenantId, ride, {
      totalCents: ride.final_price ?? 0,
    });

    await notifyService.send(tenantId, {
      userId: ride.passenger_user_id,
      channel: "push",
      template: "ride_completed",
      data: { rideId, amountCents: ride.final_price },
    });

    return ride;
  }
}

export const lifecycleService = new LifecycleService();
