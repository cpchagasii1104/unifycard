import { runQueryWithTenant, runQueriesWithTenant } from '@core/db';
import { normalizeConceptSlug } from '@core/ontology/concept-governance.service';
import { resolveConceptSlug } from '@modules/concept-resolution/concept-slug-resolve.service';

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
  concept_id?: string | null;
  is_verified: boolean;
  verified_by_partner_id?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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

export type CreateVehicleResult = RideVehicle & { conceptNeedsResolution: boolean };

export class VehiclesService {
  async createVehicle(input: CreateVehicleInput): Promise<CreateVehicleResult> {
    let conceptId: string | null = null;
    let conceptNeedsResolution = false;

    if (input.brand || input.model) {
      try {
        const rawSlug = [input.brand, input.model].filter(Boolean).join(' ');
        const normalized = normalizeConceptSlug(rawSlug);
        const resolved = await resolveConceptSlug({
          slug: normalized,
          context: 'vehicle',
        });

        if (resolved.status === 'resolved') {
          conceptId = resolved.conceptId;
        } else {
          conceptNeedsResolution = true;
        }
      } catch (err) {
        console.error('[VehiclesService] resolveConceptSlug failed (non-blocking)', err);
        conceptId = null;
        conceptNeedsResolution = true;
      }
    }

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
        concept_id,
        is_verified,
        verified_by_partner_id,
        verifiedAt
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,null,null
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
          conceptId,
        ],
      }
    );

    if (!row) {
      throw new Error('Failed to create vehicle');
    }

    return {
      ...row,
      conceptNeedsResolution,
    };
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
        verifiedAt = now(),
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

