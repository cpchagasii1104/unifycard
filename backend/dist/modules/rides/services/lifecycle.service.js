"use strict";
// src/modules/rides/services/lifecycle.service.ts
//
// Lógica oficial de Lifecycle do módulo Rides.
// Rotas chamam este service para garantir:
//   - atomicidade
//   - validações
//   - integração com Economy / Reviews
//   - emissão de eventos
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.lifecycleService = void 0;
const db_1 = require("@core/db");
const pricing_service_1 = require("./pricing.service");
const event_bus_1 = require("@core/events/event-bus");
const notify_service_1 = require("@core/notify/notify.service");
const payment_1 = require("../shared/payment");
const errors_1 = require("@core/errors");
class LifecycleService {
    // criar ride request
    async createRequest(tenantId, passengerId, data) {
        const { origin, destination, serviceTypeId, stops, } = data;
        if (!origin?.lat || !origin?.lng) {
            throw new errors_1.BadRequestError("origin missing");
        }
        const [request] = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const rows = await trx.query({
                text: `
          INSERT INTO rides_ride_requests (
            passenger_user_id,
            origin,
            destination,
            service_type_id,
            status,
            createdAt
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
                values: [
                    passengerId,
                    origin.lng, origin.lat,
                    destination.lng, destination.lat,
                    serviceTypeId,
                ],
            });
            if (stops?.length) {
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
            return rows;
        });
        event_bus_1.eventBus.emit({
            type: "rides.request.created",
            tenantId,
            payload: {
                rideRequestId: request.ride_request_id,
                passengerId,
            },
        });
        return request;
    }
    // criar ride a partir de driver assignment
    async assignDriver(tenantId, data) {
        const { rideRequestId, driverId, vehicleId } = data;
        const [ride] = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            await trx.query({
                text: `
          UPDATE rides_ride_requests
          SET status = 'driver_assigned'
          WHERE ride_request_id = $1;
        `,
                values: [rideRequestId],
            });
            const rows = await trx.query({
                text: `
          INSERT INTO rides_rides (
            ride_request_id,
            driver_id,
            vehicle_id,
            passenger_user_id,
            status,
            createdAt
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
                values: [rideRequestId, driverId, vehicleId],
            });
            return rows;
        });
        event_bus_1.eventBus.emit({
            type: "rides.ride.driver_assigned",
            tenantId,
            payload: {
                rideId: ride.ride_id,
                driverId,
            },
        });
        return ride;
    }
    // motorista inicia corrida
    async startRide(tenantId, rideId, driverUserId) {
        const [ride] = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const [info] = await trx.query({
                text: `
          SELECT r.*, d.user_id AS driver_user_id
          FROM rides_rides r
          JOIN rides_drivers d ON d.driver_id = r.driver_id
          WHERE ride_id = $1;
        `,
                values: [rideId],
            });
            if (!info)
                throw new errors_1.NotFoundError("Ride not found");
            if (info.driver_user_id !== driverUserId) {
                throw new errors_1.ConflictError("Unauthorized driver");
            }
            await trx.query({
                text: `
          UPDATE rides_rides
          SET status = 'started',
              startedAt = NOW()
          WHERE ride_id = $1;
        `,
                values: [rideId],
            });
            await trx.query({
                text: `
          INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
          VALUES ($1, 'ride_started', NOW());
        `,
                values: [rideId],
            });
            return info;
        });
        event_bus_1.eventBus.emit({
            type: "rides.ride.started",
            tenantId,
            payload: { rideId },
        });
        return ride;
    }
    // finalizar corrida
    async completeRide(tenantId, driverUserId, data) {
        const { rideId, totalDistanceKm, totalDurationMinutes, waitTimeSeconds, tipAmount, } = data;
        const ride = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const [found] = await trx.query({
                text: `
          SELECT r.*, d.user_id AS driver_user_id
          FROM rides_rides r
          JOIN rides_drivers d ON d.driver_id = r.driver_id
          WHERE ride_id = $1;
        `,
                values: [rideId],
            });
            if (!found)
                throw new errors_1.NotFoundError("Ride not found");
            if (found.driver_user_id !== driverUserId) {
                throw new errors_1.ConflictError("Unauthorized");
            }
            // calcular preço
            const pricing = await pricing_service_1.pricingService.calculate({
                tenantId,
                rideId,
                distanceKm: totalDistanceKm,
                durationMinutes: totalDurationMinutes,
                waitTimeSeconds,
            });
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
          WHERE ride_id = $1
          RETURNING *;
        `,
                values: [
                    rideId,
                    pricing.total,
                    totalDistanceKm,
                    totalDurationMinutes,
                    waitTimeSeconds ?? null,
                    tipAmount ?? 0,
                ],
            });
            await trx.query({
                text: `
          INSERT INTO rides_ride_events (ride_id, event_type, occurredAt)
          VALUES ($1, 'ride_completed', NOW());
        `,
                values: [rideId],
            });
            return updated;
        });
        // pagamento
        await (0, payment_1.processRidePayment)({
            tenantId,
            rideId,
            passengerId: ride.passenger_user_id,
            driverId: ride.driver_id,
            totalAmount: ride.final_price,
            platformFeePercent: 15,
            communityFeePercent: 2,
            driverIncentives: 0,
            tipAmount: tipAmount ?? 0,
        });
        // evento
        event_bus_1.eventBus.emit({
            type: "rides.ride.completed",
            tenantId,
            payload: {
                rideId,
                passengerId: ride.passenger_user_id,
                driverId: ride.driver_id,
                finalPrice: ride.final_price,
            },
        });
        // notificação
        await notify_service_1.notifyService.send(tenantId, {
            userId: ride.passenger_user_id,
            channel: "push",
            template: "ride_completed",
            data: { rideId, amountCents: ride.final_price },
        });
        return ride;
    }
}
exports.lifecycleService = new LifecycleService();
