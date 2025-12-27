"use strict";
// src/modules/rides/rides/rides.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ridesService = exports.RidesService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const pricing_service_1 = require("../pricing/pricing.service");
const distribution_service_1 = require("../distribution/distribution.service");
const review_service_1 = require("@core/reviews/review.service");
class RidesService {
    // ============================================================================================
    // 🔹 1. Criar ride a partir do request
    // ============================================================================================
    async createRideFromRequest(tenantId, requestId, driverId) {
        const req = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_ride_requests
        WHERE tenant_id = $1 AND request_id = $2
      `,
            values: [tenantId, requestId],
        });
        if (!req)
            throw new errors_1.NotFoundError('Request não encontrada.');
        if (req.status !== 'assigned') {
            throw new errors_1.BadRequestError('Request ainda não foi aceita por um motorista.');
        }
        // Criar ride
        const ride = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_rides (
          tenant_id, request_id, passenger_user_id,
          driver_id, service_type_id,
          passenger_count,
          origin, destination, stops,
          status, created_at
        )
        VALUES (
          $1, $2, $3,
          $4, $5,
          $6,
          $7, $8, $9,
          'driver_assigned', now()
        )
        RETURNING *
      `,
            values: [
                tenantId,
                requestId,
                req.passenger_user_id,
                driverId,
                req.service_type_id,
                req.passenger_count,
                req.origin,
                req.destination,
                req.stops,
            ],
        });
        if (!ride) {
            throw new Error('Failed to create ride');
        }
        // Emitir evento
        await event_bus_1.eventBus.emit({
            type: 'rides.ride.driver_assigned',
            tenantId,
            payload: {
                rideId: ride.ride_id,
                requestId,
                driverId,
            },
        });
        return ride;
    }
    // ============================================================================================
    // 🔹 2. Motorista chegou
    // ============================================================================================
    async markDriverArrived(tenantId, rideId) {
        const ride = await this.getRide(tenantId, rideId);
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_rides
        SET status = 'driver_arrived',
            driver_arrived_at = now(),
            updated_at = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
            values: [tenantId, rideId],
        });
        if (!updated) {
            throw new Error('Failed to update ride status');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.ride.driver_arrived',
            tenantId,
            payload: {
                rideId,
            },
        });
        return updated;
    }
    // ============================================================================================
    // 🔹 3. Começar corrida
    // ============================================================================================
    async startRide(tenantId, rideId) {
        const ride = await this.getRide(tenantId, rideId);
        if (ride.status !== 'driver_arrived') {
            throw new errors_1.BadRequestError('Corrida ainda não está pronta para iniciar.');
        }
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_rides
        SET status = 'in_progress',
            started_at = now(),
            updated_at = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
            values: [tenantId, rideId],
        });
        if (!updated) {
            throw new Error('Failed to start ride');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.ride.started',
            tenantId,
            payload: {
                rideId,
            },
        });
        return updated;
    }
    // ============================================================================================
    // 🔹 4. Completar corrida
    // ============================================================================================
    async completeRide(tenantId, rideId) {
        const ride = await this.getRide(tenantId, rideId);
        if (ride.status !== 'in_progress') {
            throw new errors_1.BadRequestError('Corrida não está em andamento.');
        }
        // Calcular preço final
        const price = await pricing_service_1.pricingService.calculateFinalPrice(tenantId, rideId);
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_rides
        SET status = 'completed',
            completed_at = now(),
            final_price = $3,
            updated_at = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
            values: [tenantId, rideId, price.total],
        });
        if (!updated) {
            throw new Error('Failed to complete ride');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.ride.completed',
            tenantId,
            payload: {
                rideId,
                finalPrice: price.total,
            },
        });
        // Processar pagamento (Economy + Distribution)
        await distribution_service_1.distributionService.processRidePayment(tenantId, updated, price);
        // Emitir evento de pagamento concluído
        await event_bus_1.eventBus.emit({
            type: 'rides.ride.paid',
            tenantId,
            payload: {
                rideId,
            },
        });
        return {
            ride: updated,
            price,
        };
    }
    // ============================================================================================
    // 🔹 5. Cancelar corrida
    // ============================================================================================
    async cancelRide(tenantId, rideId, reason, cancelledBy) {
        const ride = await this.getRide(tenantId, rideId);
        if (ride.status === 'completed') {
            throw new errors_1.BadRequestError('Corrida já foi finalizada.');
        }
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_rides
        SET status = 'cancelled',
            cancel_reason = $3,
            cancelled_by = $4,
            cancelled_at = now(),
            updated_at = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
            values: [tenantId, rideId, reason, cancelledBy],
        });
        if (!updated) {
            throw new Error('Failed to cancel ride');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.ride.cancelled',
            tenantId,
            payload: {
                rideId,
                reason,
                cancelledBy,
            },
        });
        return updated;
    }
    // ============================================================================================
    // 🔹 6. Registrar parada completada
    // ============================================================================================
    async completeStop(tenantId, rideId, stopOrder) {
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_ride_stops
        SET status = 'completed',
            completed_at = now(),
            updated_at = now()
        WHERE tenant_id = $1 AND ride_id = $2 AND stop_order = $3
        RETURNING *
      `,
            values: [tenantId, rideId, stopOrder],
        });
        if (!updated) {
            throw new Error('Failed to complete stop');
        }
        return updated;
    }
    // ============================================================================================
    // 🔹 7. Tracking GPS da corrida
    // ============================================================================================
    async addRideLocation(tenantId, rideId, lat, lng) {
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_ride_locations (
          tenant_id, ride_id, location, created_at
        )
        VALUES (
          $1, $2,
          ST_SetSRID(ST_MakePoint($4, $3), 4326),
          now()
        )
      `,
            values: [tenantId, rideId, lat, lng],
        });
    }
    // ============================================================================================
    // 🔹 8. Reviews pós corrida
    // ============================================================================================
    async reviewDriver(tenantId, rideId, passengerId, rating) {
        const ride = await this.getRide(tenantId, rideId);
        await review_service_1.reviewService.createReview(tenantId, passengerId, 'rides', {
            entityType: 'driver',
            entityId: ride.driver_id,
            rating,
            context: { rideId },
        });
        return { ok: true };
    }
    async reviewPassenger(tenantId, rideId, driverId, rating) {
        const ride = await this.getRide(tenantId, rideId);
        await review_service_1.reviewService.createReview(tenantId, driverId, 'rides', {
            entityType: 'passenger',
            entityId: ride.passenger_user_id,
            rating,
            context: { rideId },
        });
        return { ok: true };
    }
    // ============================================================================================
    // 🔹 Utilitário: buscar corrida
    // ============================================================================================
    async getRide(tenantId, rideId) {
        const ride = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
            values: [tenantId, rideId],
        });
        if (!ride)
            throw new errors_1.NotFoundError('Corrida não encontrada.');
        return ride;
    }
}
exports.RidesService = RidesService;
exports.ridesService = new RidesService();
//# sourceMappingURL=rides.service.js.map