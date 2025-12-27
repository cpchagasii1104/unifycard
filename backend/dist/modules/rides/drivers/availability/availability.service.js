"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityService = exports.AvailabilityService = void 0;
const db_1 = require("@core/db");
class AvailabilityService {
    async setOnline(input) {
        const row = await (0, db_1.runQueryWithTenant)(input.tenantId, {
            text: `
      INSERT INTO rides_driver_availability (
        tenant_id,
        driver_id,
        is_online,
        current_zone_id,
        current_lat,
        current_lng
      )
      VALUES ($1,$2,true,$3,$4,$5)
      ON CONFLICT (driver_id)
      DO UPDATE SET
        is_online = true,
        current_zone_id = $3,
        current_lat = $4,
        current_lng = $5,
        updated_at = now()
      RETURNING *
      `,
            values: [
                input.tenantId,
                input.driverId,
                input.zoneId ?? null,
                input.lat ?? null,
                input.lng ?? null,
            ],
        });
        return row;
    }
    async setOffline(driverId) {
        const row = await (0, db_1.runQueryWithTenant)(driverId, {
            text: `
      UPDATE rides_driver_availability
      SET 
        is_online = false,
        destination_enabled = false,
        updated_at = now()
      WHERE driver_id = $1
      RETURNING *
      `,
            values: [driverId],
        });
        return row;
    }
    async setDestinationMode(input) {
        const row = await (0, db_1.runQueryWithTenant)(input.tenantId, {
            text: `
      UPDATE rides_driver_availability
      SET
        destination_enabled = true,
        destination_lat = $2,
        destination_lng = $3,
        destination_deadline = $4,
        destination_slots_remaining = $5,
        updated_at = now()
      WHERE tenant_id = $1 AND driver_id = $6
      RETURNING *
      `,
            values: [
                input.tenantId,
                input.destinationLat,
                input.destinationLng,
                input.deadline,
                input.slotsRemaining,
                input.driverId,
            ],
        });
        return row;
    }
    async disableDestinationMode(driverId, tenantId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_driver_availability
      SET
        destination_enabled = false,
        destination_lat = null,
        destination_lng = null,
        destination_deadline = null,
        updated_at = now()
      WHERE driver_id = $1 AND tenant_id = $2
      RETURNING *
      `,
            values: [driverId, tenantId],
        });
        return row;
    }
    async rewardDestinationSlot(driverId, tenantId) {
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_driver_availability
      SET destination_slots_remaining = destination_slots_remaining + 1,
          updated_at = now()
      WHERE driver_id = $1 AND tenant_id = $2
      `,
            values: [driverId, tenantId],
        });
    }
    async getAvailability(driverId) {
        const row = await (0, db_1.runQueryWithTenant)(driverId, {
            text: `SELECT * FROM rides_driver_availability WHERE driver_id = $1`,
            values: [driverId],
        });
        return row ?? null;
    }
}
exports.AvailabilityService = AvailabilityService;
exports.availabilityService = new AvailabilityService();
//# sourceMappingURL=availability.service.js.map