"use strict";
// src/modules/rides/ride-requests/ride-requests.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.rideRequestsService = exports.RideRequestsService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const pricing_service_1 = require("../pricing/pricing.service");
class RideRequestsService {
    // ================================================================================
    // 🔹 1. Criar solicitação de corrida
    // ================================================================================
    async createRequest(tenantId, passengerId, data) {
        const { origin, destination, stops = [], passenger_count = 1, service_type_id, city_id } = data;
        if (!origin?.lat || !origin?.lng) {
            throw new errors_1.BadRequestError("Origem inválida.");
        }
        if (!destination?.lat || !destination?.lng) {
            throw new errors_1.BadRequestError("Destino inválido.");
        }
        // Gerar preço estimado
        const priceEst = await pricing_service_1.pricingService.calculateEstimate(tenantId, city_id, {
            origin,
            destination,
            stops,
            passenger_count,
            service_type_id,
        });
        // Criar request no banco
        const request = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_ride_requests (
        tenant_id, passenger_user_id,
        origin, destination,
        stops, stops_count,
        passenger_count,
        service_type_id, city_id,
        estimated_price,
        status, createdAt
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
            values: [
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
                priceEst.total,
            ],
        });
        if (!request) {
            throw new Error('Failed to create ride request');
        }
        await event_bus_1.eventBus.emit({
            type: "rides.ride_request.created",
            tenantId,
            payload: {
                requestId: request.request_id,
            },
        });
        // Buscar motoristas
        const match = await this.findDriversForRequest(tenantId, request, passenger_count, service_type_id);
        return {
            ok: true,
            request,
            drivers: match,
            estimated_price: priceEst,
        };
    }
    // ================================================================================
    // 🔹 2. Matching — encontrar motoristas ideais
    // ================================================================================
    async findDriversForRequest(tenantId, request, passengerCount, serviceTypeId) {
        const { origin } = request;
        const drivers = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT * FROM rides_find_nearby_drivers(
        $1, $2, $3,
        6,              -- raio de 6km
        $4,             -- tipo de serviço
        $5,             -- capacidade mínima
        10              -- máximo 10 motoristas
      )
      `,
            values: [
                tenantId,
                origin.y, // lat
                origin.x, // lng
                serviceTypeId,
                passengerCount,
            ],
        });
        if (drivers.length === 0) {
            await event_bus_1.eventBus.emit({
                type: "rides.ride_request.no_driver",
                tenantId,
                payload: {
                    requestId: request.request_id,
                },
            });
            return [];
        }
        // Gravar ofertas
        for (const d of drivers) {
            await (0, db_1.runQueryWithTenant)(tenantId, {
                text: `
        INSERT INTO rides_request_offers (
          tenant_id, request_id, driver_id,
          distance_km, createdAt
        )
        VALUES ($1,$2,$3,$4, now())
        `,
                values: [tenantId, request.request_id, d.driver_id, d.distance_km],
            });
        }
        await event_bus_1.eventBus.emit({
            type: "rides.ride_request.searching",
            tenantId,
            payload: {
                requestId: request.request_id,
            },
        });
        return drivers;
    }
    // ================================================================================
    // 🔹 3. Motorista aceita corrida
    // ================================================================================
    async driverAccept(tenantId, driverId, requestId) {
        const req = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT * FROM rides_ride_requests
      WHERE tenant_id = $1 AND request_id = $2
      `,
            values: [tenantId, requestId],
        });
        if (!req)
            throw new errors_1.NotFoundError("Solicitação não encontrada.");
        if (req.status !== "pending" && req.status !== "searching") {
            throw new errors_1.BadRequestError("Solicitação já aceita ou expirada.");
        }
        // Encerra outras ofertas
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_request_offers
      SET accepted = false, expired = true
      WHERE tenant_id = $1 AND request_id = $2 AND driver_id <> $3
      `,
            values: [tenantId, requestId, driverId],
        });
        // Atualiza request
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_ride_requests
      SET assigned_driver_id = $3,
          status = 'assigned',
          assignedAt = now()
      WHERE tenant_id = $1 AND request_id = $2
      RETURNING *
      `,
            values: [tenantId, requestId, driverId],
        });
        if (!updated) {
            throw new Error('Failed to update ride request');
        }
        await event_bus_1.eventBus.emit({
            type: "rides.ride.driver_assigned",
            tenantId,
            payload: {
                requestId,
                driverId,
            },
        });
        return updated;
    }
    // ================================================================================
    // 🔹 4. Cancelamento da solicitação
    // ================================================================================
    async cancelRequest(tenantId, requestId, userId) {
        const req = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_ride_requests
      WHERE tenant_id = $1 AND request_id = $2
      `,
            values: [tenantId, requestId],
        });
        if (!req)
            throw new errors_1.NotFoundError("Pedido não encontrado.");
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_ride_requests
      SET status = 'cancelled',
          cancelled_by = $3,
          cancelledAt = now()
      WHERE tenant_id = $1 AND request_id = $2
      `,
            values: [tenantId, requestId, userId],
        });
        await event_bus_1.eventBus.emit({
            type: "rides.ride_request.cancelled",
            tenantId,
            payload: {
                requestId,
                userId,
            },
        });
        return { ok: true };
    }
}
exports.RideRequestsService = RideRequestsService;
exports.rideRequestsService = new RideRequestsService();
