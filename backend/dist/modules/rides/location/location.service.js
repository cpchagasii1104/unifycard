"use strict";
// src/modules/rides/location/location.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationService = exports.LocationService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const availability_service_1 = require("../availability/availability.service");
const zones_service_1 = require("../zones/zones.service");
const demand_service_1 = require("../demand/demand.service");
class LocationService {
    // ================================================================================
    // 🔹 1. Atualizar localização do motorista
    // ================================================================================
    async updateDriverLocation(tenantId, driverId, lat, lng) {
        if (!lat || !lng) {
            throw new errors_1.BadRequestError("Coordenadas inválidas.");
        }
        // Verificar se o motorista está online
        const isOnline = await availability_service_1.availabilityService.isOnline(tenantId, driverId);
        if (!isOnline) {
            throw new errors_1.BadRequestError("Motorista está offline.");
        }
        // Atualizar posição geográfica
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_driver_locations (
        tenant_id, driver_id, location, updated_at
      )
      VALUES (
        $1, $2,
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
        // Emitir evento básico
        await event_bus_1.eventBus.emit({
            type: "rides.driver.location.updated",
            tenantId,
            payload: {
                driverId,
                lat,
                lng,
            },
        });
        // ------------------------------------------------------------
        // 🔹 2. Identificar zona atual do motorista
        // ------------------------------------------------------------
        const zone = await zones_service_1.zonesService.findZoneByPoint(tenantId, lat, lng);
        if (zone) {
            await event_bus_1.eventBus.emit({
                type: "rides.driver.zone.changed",
                tenantId,
                payload: {
                    driverId,
                    zoneId: zone.zone_id,
                },
            });
        }
        // ------------------------------------------------------------
        // 🔹 3. Identificar cidade do motorista (se o admin quiser usar)
        // ------------------------------------------------------------
        // NOTA: cidades podem ser baseadas em bounding box ou polígono.
        // Aqui usamos a função SQL do banco.
        const city = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT c.city_id, c.name
      FROM rides_cities c
      WHERE tenant_id = $1
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
          ST_SetSRID(ST_MakePoint(c.lng, c.lat), 4326)::geography,
          30000 -- 30km de tolerância
        )
      LIMIT 1;
      `,
            values: [tenantId, lat, lng],
        });
        if (city) {
            await event_bus_1.eventBus.emit({
                type: "rides.driver.city.changed",
                tenantId,
                payload: {
                    driverId,
                    cityId: city.city_id,
                },
            });
        }
        // ------------------------------------------------------------
        // 🔹 4. Atualizar tempo dirigido (1 min a cada update útil)
        // ------------------------------------------------------------
        await availability_service_1.availabilityService.incrementDrivingTime(tenantId, driverId, 1);
        // ------------------------------------------------------------
        // 🔹 5. Verificar limite automático de direção
        // ------------------------------------------------------------
        const limitStateRow = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT rides_check_driving_limit($1, $2) AS state`,
            values: [tenantId, driverId],
        });
        if (!limitStateRow?.state.can_drive) {
            // Forçar offline
            await availability_service_1.availabilityService.goOffline(tenantId, driverId);
            await event_bus_1.eventBus.emit({
                type: "rides.driver.forced_break",
                tenantId,
                payload: {
                    driverId,
                    reason: limitStateRow?.state.reason,
                    forcedBreakUntil: limitStateRow?.state.forced_break_until,
                },
            });
            return {
                ok: false,
                error: "Motorista atingiu o limite de direção.",
                limit: limitStateRow?.state ?? { can_drive: false, reason: 'Unknown', forced_break_until: null },
            };
        }
        // ------------------------------------------------------------
        // 🔹 6. Calcular ganhos atualizados
        // ------------------------------------------------------------
        const earningsRow = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT rides_calculate_realtime_earnings($1, $2) AS data`,
            values: [tenantId, driverId],
        });
        // ------------------------------------------------------------
        // 🔹 7. Sugerir zona de maior ganho (incentivos)
        // ------------------------------------------------------------
        let suggestions = null;
        if (zone) {
            const pressureData = await demand_service_1.demandService.calculateZonePressure(tenantId, zone.zone_id);
            if (pressureData.level === "high" || pressureData.level === "critical") {
                // ZONA QUENTE → sugira ao motorista
                suggestions = await demand_service_1.demandService.suggestBetterZone(tenantId, driverId);
                await event_bus_1.eventBus.emit({
                    type: "rides.zone.hotspot",
                    tenantId,
                    payload: {
                        driverId,
                        zoneId: zone.zone_id,
                        pressure: pressureData.pressure,
                    },
                });
            }
        }
        return {
            ok: true,
            zone,
            city,
            earnings: earningsRow?.data,
            suggestions,
            limit: limitStateRow?.state ?? { can_drive: true, reason: null, forced_break_until: null },
        };
    }
    // ================================================================================
    // 🔹 2. Última localização do motorista (para matching)
    // ================================================================================
    async getDriverLocation(tenantId, driverId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT 
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        updated_at
      FROM rides_driver_locations
      WHERE tenant_id = $1 AND driver_id = $2
      `,
            values: [tenantId, driverId],
        });
        if (!row)
            throw new errors_1.NotFoundError("Localização não encontrada.");
        return row;
    }
    async updateLocation(input) {
        return this.updateDriverLocation(input.tenantId, input.driverId, input.lat, input.lng);
    }
    async calculateDistanceMeters(lat1, lng1, lat2, lng2) {
        // Haversine formula
        const R = 6371000; // Earth radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    async calculateETASeconds(distanceMeters) {
        // Simple calculation: assume average speed of 30 km/h (8.33 m/s)
        const avgSpeedMps = 8.33;
        return Math.round(distanceMeters / avgSpeedMps);
    }
}
exports.LocationService = LocationService;
exports.locationService = new LocationService();
//# sourceMappingURL=location.service.js.map