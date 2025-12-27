import { runQueryWithTenant, runQueriesWithTenant } from '@core/db';

// Types based on usage
export interface RideVehicle {
  vehicle_id: string;
  tenant_id: string;
  driver_id: string;
  plate: string;
  model?: string;
  brand?: string;
  year?: number;
  color?: string;
  category?: string;
  service_type_id?: string;
  is_verified: boolean;
  verified_by_partner_id?: string;
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVehicleInput {
  tenantId: string;
  driverId: string;
  plate: string;
  model?: string;
  brand?: string;
  year?: number;
  color?: string;
  category?: string;
  serviceTypeId?: string;
}

export interface UpdateVehicleInput {
  plate?: string;
  model?: string;
  brand?: string;
  year?: number;
  color?: string;
  category?: string;
  serviceTypeId?: string;
}

export class VehiclesService {
  async createVehicle(input: CreateVehicleInput): Promise<RideVehicle> {
    const row = await runQueryWithTenant<RideVehicle>(
      input.tenantId,
      {
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
        verified_at
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
      }
    );

    if (!row) {
      throw new Error('Failed to create vehicle');
    }

    return row;
  }

  async updateVehicle(tenantId: string, vehicleId: string, input: UpdateVehicleInput): Promise<RideVehicle> {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of Object.keys(input)) {
      if (input[key as keyof UpdateVehicleInput] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push((input as any)[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(vehicleId);

    const row = await runQueryWithTenant<RideVehicle>(
      tenantId,
      {
        text: `
      UPDATE rides_vehicles
      SET ${fields.join(', ')}, updated_at = now()
      WHERE vehicle_id = $${idx}
      RETURNING *
      `,
        values,
      }
    );

    if (!row) {
      throw new Error('Vehicle not found');
    }

    return row;
  }

  async listVehicles(tenantId: string, driverId: string): Promise<RideVehicle[]> {
    return runQueriesWithTenant<RideVehicle>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_vehicles
      WHERE driver_id = $1
      ORDER BY created_at DESC
      `,
        values: [driverId],
      }
    );
  }

  async getVehicleById(tenantId: string, vehicleId: string): Promise<RideVehicle | null> {
    const row = await runQueryWithTenant<RideVehicle>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_vehicles
      WHERE vehicle_id = $1
      `,
        values: [vehicleId],
      }
    );
    return row ?? null;
  }

  async verifyVehicle(tenantId: string, vehicleId: string, partnerId: string): Promise<RideVehicle> {
    const row = await runQueryWithTenant<RideVehicle>(
      tenantId,
      {
        text: `
      UPDATE rides_vehicles
      SET
        is_verified = true,
        verified_by_partner_id = $2,
        verified_at = now(),
        updated_at = now()
      WHERE vehicle_id = $1
      RETURNING *
      `,
        values: [vehicleId, partnerId],
      }
    );

    if (!row) {
      throw new Error('Vehicle not found');
    }

    return row;
  }
}

export const vehiclesService = new VehiclesService();
