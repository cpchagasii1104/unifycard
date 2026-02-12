"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehiclesService = exports.VehiclesService = void 0;
const db_1 = require("@core/db");
class VehiclesService {
    async createVehicle(input) {
        const row = await (0, db_1.runQueryWithTenant)(input.tenantId, {
            text: `
      INSERT INTO rides_vehicles (
        tenant_id,
        driver_id,
        plate,
        model,
        brand,
        year,
        color,
        category,
        service_type_id,
        is_verified,
        verified_by_partner_id,
        verifiedAt
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,false,null,null
      )
      RETURNING *
      `,
            values: [
                input.tenantId,
                input.driverId,
                input.plate,
                input.model,
                input.brand,
                input.year,
                input.color,
                input.category,
                input.serviceTypeId,
            ],
        });
        if (!row) {
            throw new Error('Failed to create vehicle');
        }
        return row;
    }
    async updateVehicle(tenantId, vehicleId, input) {
        const fields = [];
        const values = [];
        let idx = 1;
        for (const key of Object.keys(input)) {
            if (input[key] !== undefined) {
                fields.push(`${key} = $${idx}`);
                values.push(input[key]);
                idx++;
            }
        }
        if (fields.length === 0) {
            throw new Error('No fields to update');
        }
        values.push(vehicleId);
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_vehicles
      SET ${fields.join(', ')}, updatedAt = now()
      WHERE vehicle_id = $${idx}
      RETURNING *
      `,
            values,
        });
        if (!row) {
            throw new Error('Vehicle not found');
        }
        return row;
    }
    async listVehicles(tenantId, driverId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_vehicles
      WHERE driver_id = $1
      ORDER BY createdAt DESC
      `,
            values: [driverId],
        });
    }
    async getVehicleById(tenantId, vehicleId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_vehicles
      WHERE vehicle_id = $1
      `,
            values: [vehicleId],
        });
        return row ?? null;
    }
    async verifyVehicle(tenantId, vehicleId, partnerId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_vehicles
      SET
        is_verified = true,
        verified_by_partner_id = $2,
        verifiedAt = now(),
        updatedAt = now()
      WHERE vehicle_id = $1
      RETURNING *
      `,
            values: [vehicleId, partnerId],
        });
        if (!row) {
            throw new Error('Vehicle not found');
        }
        return row;
    }
}
exports.VehiclesService = VehiclesService;
exports.vehiclesService = new VehiclesService();
