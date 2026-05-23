// src/modules/rides/ride-requests/ride-requests.service.ts

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from "@core/db";
import { BadRequestError, NotFoundError } from "@core/errors";
import { pricingService } from "../pricing/pricing.service";
import { publishRideEventOutbox } from "../shared/publish-ride-event";

export class RideRequestsService {
  // ================================================================================
  // 🔹 1. Criar solicitação de corrida
  // ================================================================================
  async createRequest(tenantId: string, passengerId: string, data: any) {
    const {
      origin,
      destination,
      stops = [],
      passenger_count = 1,
      service_type_id,
      city_id
    } = data;

    if (!origin?.lat || !origin?.lng) {
      throw new BadRequestError("Origem inválida.");
    }
    if (!destination?.lat || !destination?.lng) {
      throw new BadRequestError("Destino inválido.");
    }

    const priceEst = await pricingService.calculateEstimate(
      tenantId,
      city_id,
      {
        origin,
        destination,
        stops,
        passenger_count,
        service_type_id,
      }
    );

    const result = await runTenantTransactionWithClient(tenantId, async (client) => {
      const requestRes = await client.query(
        `
      INSERT INTO rides_ride_requests (
        tenant_id, passenger_user_id,
        origin, destination,
        stops, stops_count,
        passenger_count,
        service_type_id, city_id,
        estimated_price,
        status, created_at
      )
      VALUES (
        $1, $2,
        ST_SetSRID(ST_MakePoint($4,$3),4326),
        ST_SetSRID(ST_MakePoint($6,$5),4326),
        $7, jsonb_array_length($7),
        $8,
        $9, $10,
        $11,
        'pending', now()
      )
      RETURNING *
      `,
        [
          tenantId,
          passengerId,
          origin.lat,
          origin.lng,
          destination.lat,
          destination.lng,
          JSON.stringify(stops),
          passenger_count,
          service_type_id,
          city_id,
          priceEst.totalCents,
        ]
      );

      const request = requestRes.rows[0];
      if (!request) {
        throw new Error("Failed to create ride request");
      }

      await publishRideEventOutbox(client, {
        type: "rides.ride_request.created",
        tenantId,
        payload: {
          requestId: request.request_id,
        },
      });

      const driversRes = await client.query(
        `
      SELECT * FROM rides_find_nearby_drivers(
        $1, $2, $3,
        6,
        $4,
        $5,
        10
      )
      `,
        [
          tenantId,
          request.origin.y,
          request.origin.x,
          service_type_id,
          passenger_count,
        ]
      );
      const drivers = driversRes.rows;

      if (drivers.length === 0) {
        await publishRideEventOutbox(client, {
          type: "rides.ride_request.no_driver",
          tenantId,
          payload: {
            requestId: request.request_id,
          },
        });
        return {
          ok: true,
          request,
          drivers: [],
          estimated_price: priceEst,
        };
      }

      for (const d of drivers) {
        await client.query(
          `
        INSERT INTO rides_request_offers (
          tenant_id, request_id, driver_id,
          distance_km, created_at
        )
        VALUES ($1,$2,$3,$4, now())
        `,
          [tenantId, request.request_id, d.driver_id, d.distance_km]
        );
      }

      await publishRideEventOutbox(client, {
        type: "rides.ride_request.searching",
        tenantId,
        payload: {
          requestId: request.request_id,
        },
      });

      return {
        ok: true,
        request,
        drivers,
        estimated_price: priceEst,
      };
    });

    return result;
  }

  // ================================================================================
  // 🔹 2. Matching — encontrar motoristas ideais (legado; fluxo principal em createRequest)
  // ================================================================================
  async findDriversForRequest(
    tenantId: string,
    request: any,
    passengerCount: number,
    serviceTypeId: string
  ) {
    const { origin } = request;

    const drivers = await runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT * FROM rides_find_nearby_drivers(
        $1, $2, $3,
        6,
        $4,
        $5,
        10
      )
      `,
        values: [
          tenantId,
          origin.y,
          origin.x,
          serviceTypeId,
          passengerCount,
        ],
      }
    );

    if (drivers.length === 0) {
      await runTenantTransactionWithClient(tenantId, async (client) => {
        await publishRideEventOutbox(client, {
          type: "rides.ride_request.no_driver",
          tenantId,
          payload: {
            requestId: request.request_id,
          },
        });
      });
      return [];
    }

    await runTenantTransactionWithClient(tenantId, async (client) => {
      for (const d of drivers) {
        await client.query(
          `
        INSERT INTO rides_request_offers (
          tenant_id, request_id, driver_id,
          distance_km, created_at
        )
        VALUES ($1,$2,$3,$4, now())
        `,
          [tenantId, request.request_id, d.driver_id, d.distance_km]
        );
      }

      await publishRideEventOutbox(client, {
        type: "rides.ride_request.searching",
        tenantId,
        payload: {
          requestId: request.request_id,
        },
      });
    });

    return drivers;
  }

  // ================================================================================
  // 🔹 3. Motorista aceita corrida
  // ================================================================================
  async driverAccept(tenantId: string, driverId: string, requestId: string) {
    return runTenantTransactionWithClient(tenantId, async (client) => {
      const reqRes = await client.query(
        `
      SELECT * FROM rides_ride_requests
      WHERE tenant_id = $1 AND request_id = $2
      `,
        [tenantId, requestId]
      );
      const req = reqRes.rows[0];

      if (!req) throw new NotFoundError("Solicitação não encontrada.");
      if (req.status !== "pending" && req.status !== "searching") {
        throw new BadRequestError("Solicitação já aceita ou expirada.");
      }

      await client.query(
        `
      UPDATE rides_request_offers
      SET accepted = false, expired = true
      WHERE tenant_id = $1 AND request_id = $2 AND driver_id <> $3
      `,
        [tenantId, requestId, driverId]
      );

      const updatedRes = await client.query(
        `
      UPDATE rides_ride_requests
      SET assigned_driver_id = $3,
          status = 'assigned',
          assignedAt = now()
      WHERE tenant_id = $1 AND request_id = $2
      RETURNING *
      `,
        [tenantId, requestId, driverId]
      );
      const updated = updatedRes.rows[0];

      if (!updated) {
        throw new Error("Failed to update ride request");
      }

      await publishRideEventOutbox(client, {
        type: "rides.ride.driver_assigned",
        tenantId,
        payload: {
          requestId,
          driverId,
        },
      });

      return updated;
    });
  }

  // ================================================================================
  // 🔹 4. Cancelamento da solicitação
  // ================================================================================
  async cancelRequest(tenantId: string, requestId: string, userId: string) {
    const req = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_ride_requests
      WHERE tenant_id = $1 AND request_id = $2
      `,
        values: [tenantId, requestId],
      }
    );

    if (!req) throw new NotFoundError("Pedido não encontrado.");

    await runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
      UPDATE rides_ride_requests
      SET status = 'cancelled',
          cancelled_by = $3,
          cancelledAt = now()
      WHERE tenant_id = $1 AND request_id = $2
      `,
        [tenantId, requestId, userId]
      );

      await publishRideEventOutbox(client, {
        type: "rides.ride_request.cancelled",
        tenantId,
        payload: {
          requestId,
          userId,
        },
      });
    });

    return { ok: true };
  }
}

export const rideRequestsService = new RideRequestsService();
