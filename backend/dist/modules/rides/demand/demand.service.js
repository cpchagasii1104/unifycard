"use strict";
// src/modules/rides/demand/demand.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.demandService = exports.DemandService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const notify_service_1 = require("@core/notify/notify.service");
class DemandService {
    eventBusInstance;
    constructor(eventBusInstance = event_bus_1.eventBus) {
        this.eventBusInstance = eventBusInstance;
    }
    // ============================================================================
    // 🔥 1. Recalcular pressão de UMA zona
    // ============================================================================
    async calculateZonePressure(tenantId, zoneId) {
        const result = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT rides_calculate_zone_pressure($1, $2) AS data`,
            values: [tenantId, zoneId],
        });
        const data = result?.data;
        if (data.incentive_created) {
            await this.eventBusInstance.emit({
                type: 'rides.zone.high_demand',
                tenantId,
                payload: {
                    zoneId,
                    pressure: data.pressure,
                },
            });
        }
        return data;
    }
    // ============================================================================
    // 🔥 2. Recalcular TODAS as zonas (usado pelo cron job)
    // ============================================================================
    async refreshAllZones(tenantId) {
        const zones = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `SELECT zone_id FROM rides_zones WHERE tenant_id = $1`,
            values: [tenantId],
        });
        const results = [];
        for (const z of zones) {
            const res = await this.calculateZonePressure(tenantId, z.zone_id);
            results.push(res);
        }
        return results;
    }
    // ============================================================================
    // 🔥 3. Obter incentivos ativos por zona
    // ============================================================================
    async getZoneIncentives(tenantId, zoneId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_zone_incentives
      WHERE tenant_id = $1 
        AND zone_id = $2
        AND is_active = true
        AND expires_at > now()
      ORDER BY incentive_value DESC
      `,
            values: [tenantId, zoneId],
        });
    }
    // ============================================================================
    // 🔥 4. Notificar motoristas sobre zonas quentes
    // ============================================================================
    async notifyDriversHotZone(tenantId, zoneId, pressure) {
        const drivers = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT d.user_id
      FROM rides_driver_availability da
      INNER JOIN rides_driver_locations dl
        ON dl.driver_id = da.driver_id AND dl.tenant_id = da.tenant_id
      INNER JOIN rides_zones z
        ON ST_DWithin(
             dl.location::geography,
             z.polygon::geography,
             3000
           )
      INNER JOIN rides_drivers d
        ON d.driver_id = da.driver_id
      WHERE da.tenant_id = $1
        AND z.zone_id = $2
        AND da.is_online = true
      `,
            values: [tenantId, zoneId],
        });
        for (const drv of drivers) {
            await notify_service_1.notifyService.send({
                tenantId,
                channel: 'push',
                userId: drv.user_id,
                template: 'zone_high_demand',
                data: {
                    zoneId,
                    pressure,
                },
            });
        }
        return { notified: drivers.length };
    }
    // ============================================================================
    // 🔥 5. Sugestão de zona para motoristas
    // ============================================================================
    async suggestBetterZone(tenantId, _driverId) {
        const pressures = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT z.zone_id, z.name, p.pressure
      FROM rides_zones z
      INNER JOIN rides_zone_demand_pressure p
        ON p.zone_id = z.zone_id
      WHERE z.tenant_id = $1
      ORDER BY p.pressure DESC
      LIMIT 3
      `,
            values: [tenantId],
        });
        if (pressures.length === 0)
            return null;
        return pressures;
    }
    // ============================================================================
    // 🔥 6. Limpar incentivos expirados
    // ============================================================================
    async cleanupExpiredIncentives(tenantId) {
        const result = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_zone_incentives
      SET is_active = false
      WHERE tenant_id = $1
        AND expires_at < now()
      `,
            values: [tenantId],
        });
        return { deactivated: result?.rowCount ?? 0 };
    }
}
exports.DemandService = DemandService;
exports.demandService = new DemandService();
//# sourceMappingURL=demand.service.js.map