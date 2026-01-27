"use strict";
// src/modules/rides/availability/availability.service.ts
// 🔴 LEGADO — Usa estrutura temporal paralela.
// 🔴 NÃO USAR EM NOVO CÓDIGO.
// 🔴 Migrar para unified-availability.service.ts
// 
// rides_driver_availability (is_online, dest_mode_enabled) representa:
// - Estado operacional do motorista (disponível para corridas)
// - NÃO bloqueia agenda temporal
// - NÃO cria booking
// - NÃO interfere em Unified Availability
// 
// Este é estado operacional, não agenda. A verdade temporal está em Unified Availability.
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityService = exports.AvailabilityService = void 0;
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const event_bus_1 = require("@core/events/event-bus");
class AvailabilityService {
    eventBusInstance;
    constructor(eventBusInstance = event_bus_1.eventBus) {
        this.eventBusInstance = eventBusInstance;
    }
    async goOnline(tenantId, driverId, lat, lng) {
        const driver = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT driver_id, status, active_vehicle_id
        FROM rides_drivers
        WHERE tenant_id = $1 AND driver_id = $2
      `,
            values: [tenantId, driverId],
        });
        if (!driver)
            throw new errors_1.NotFoundError('Motorista não encontrado.');
        if (driver.status !== 'approved') {
            throw new errors_1.ForbiddenError('Motorista não está aprovado para operar.');
        }
        if (!driver.active_vehicle_id) {
            throw new errors_1.ForbiddenError('Defina um veículo ativo antes de ficar online.');
        }
        const limitState = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT rides_check_driving_limit($1, $2) AS state`,
            values: [tenantId, driverId],
        });
        const state = limitState?.state;
        if (!state?.can_drive) {
            throw new errors_1.ForbiddenError(`Motorista bloqueado: ${state?.reason || 'Limite excedido'}`);
        }
        const session = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          INSERT INTO rides_driver_sessions (
            tenant_id, driver_id, vehicle_id, city_id,
            started_at, is_forced_break
          )
          VALUES ($1, $2, $3, null, now(), false)
          ON CONFLICT (driver_id) WHERE ended_at IS NULL
          DO UPDATE SET updated_at = now()
          RETURNING session_id
        `,
            values: [tenantId, driverId, driver.active_vehicle_id],
        });
        const availability = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_driver_availability (
          tenant_id, driver_id, is_online, destination_mode_enabled,
          created_at, updated_at
        )
        VALUES ($1,$2,true,false,now(),now())
        ON CONFLICT (tenant_id, driver_id)
        DO UPDATE SET is_online = true, updated_at = now()
        RETURNING *
      `,
            values: [tenantId, driverId],
        });
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_driver_locations (
          tenant_id, driver_id, location, updated_at
        )
        VALUES (
          $1,$2,
          ST_SetSRID(ST_MakePoint($4, $3), 4326),
          now()
        )
        ON CONFLICT (tenant_id, driver_id)
        DO UPDATE SET
          location = EXCLUDED.location,
          updated_at = now()
      `,
            values: [tenantId, driverId, lat, lng],
        });
        await this.eventBusInstance.emit({
            type: 'rides.driver.online',
            tenantId,
            payload: { driverId },
        });
        return {
            ok: true,
            sessionId: session?.session_id,
            limit: state,
            availability,
        };
    }
    async goOffline(tenantId, driverId) {
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_driver_sessions
        SET ended_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2 AND ended_at IS NULL
      `,
            values: [tenantId, driverId],
        });
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_driver_availability
        SET is_online = false, updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
            values: [tenantId, driverId],
        });
        await this.eventBusInstance.emit({
            type: 'rides.driver.offline',
            tenantId,
            payload: { driverId },
        });
        return { ok: true };
    }
    async isOnline(tenantId, driverId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT is_online
        FROM rides_driver_availability
        WHERE tenant_id = $1 AND driver_id = $2
      `,
            values: [tenantId, driverId],
        });
        return !!row?.is_online;
    }
    async setDestinationMode(tenantId, driverId, enabled, dest) {
        const result = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_driver_availability
        SET destination_mode_enabled = $3,
            destination_mode_lat = CASE WHEN $3 THEN $4 ELSE NULL END,
            destination_mode_lng = CASE WHEN $3 THEN $5 ELSE NULL END,
            updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
            values: [
                tenantId,
                driverId,
                enabled,
                enabled ? dest?.lat : null,
                enabled ? dest?.lng : null,
            ],
        });
        await this.eventBusInstance.emit({
            type: 'rides.driver.destination_mode',
            tenantId,
            payload: { driverId, enabled },
        });
        return result;
    }
    async incrementDrivingTime(tenantId, driverId, minutes) {
        if (minutes <= 0)
            return;
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_driver_sessions
        SET driving_time_minutes = driving_time_minutes + $3,
            updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2 AND ended_at IS NULL
      `,
            values: [tenantId, driverId, minutes],
        });
        const limitState = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT rides_check_driving_limit($1, $2) AS state`,
            values: [tenantId, driverId],
        });
        if (!limitState?.state?.can_drive) {
            await this.goOffline(tenantId, driverId);
            await this.eventBusInstance.emit({
                type: 'rides.driver.forced_break',
                tenantId,
                payload: {
                    driverId,
                    reason: limitState?.state?.reason,
                },
            });
        }
    }
    async getStatus(tenantId, driverId) {
        const availability = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_driver_availability
        WHERE tenant_id = $1 AND driver_id = $2
      `,
            values: [tenantId, driverId],
        });
        const session = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_driver_sessions
        WHERE tenant_id = $1 AND driver_id = $2
        ORDER BY started_at DESC
        LIMIT 1
      `,
            values: [tenantId, driverId],
        });
        const destinations = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT destination_id, lat, lng, expires_at
        FROM rides_driver_destinations
        WHERE tenant_id = $1 AND driver_id = $2
        ORDER BY expires_at DESC
      `,
            values: [tenantId, driverId],
        });
        return {
            availability,
            session,
            destinations,
        };
    }
}
exports.AvailabilityService = AvailabilityService;
exports.availabilityService = new AvailabilityService();
