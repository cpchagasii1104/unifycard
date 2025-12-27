// src/modules/rides/services/matching.service.ts
//
// Serviço de matching.
// Encapsula a lógica acima da função SQL rides_find_nearby_drivers().
//

import { runQueryWithTenant } from "@core/db";

export interface DriverCandidate {
  driver_id: string;
  distance_km: number;
  rating_avg: number;
  can_drive: boolean;
}

export interface MatchingInput {
  tenantId: string;
  lat: number;
  lng: number;
  radiusKm?: number;
  serviceTypeId?: string;
  minCapacity?: number;
  limit?: number;
}

class MatchingService {
  async findDrivers(input: MatchingInput): Promise<DriverCandidate[]> {
    const {
      tenantId,
      lat,
      lng,
      radiusKm = 5,
      serviceTypeId,
      minCapacity = 1,
      limit = 20,
    } = input;

    const rows = await runQueryWithTenant(tenantId, {
      text: `
        SELECT *
        FROM rides_find_nearby_drivers(
          $1::text,
          $2, $3,
          $4,
          $5::text,
          $6,
          $7
        );
      `,
      values: [
        tenantId,
        lat,
        lng,
        radiusKm,
        serviceTypeId ?? null,
        minCapacity,
        limit,
      ],
    });

    // ordenação extra
    return rows.sort((a: DriverCandidate, b: DriverCandidate) => {
      if (a.can_drive && !b.can_drive) return -1;
      if (!a.can_drive && b.can_drive) return 1;

      if (a.distance_km !== b.distance_km) {
        return a.distance_km - b.distance_km;
      }

      return b.rating_avg - a.rating_avg;
    });
  }

  async pickBestDriver(input: MatchingInput) {
    const drivers = await this.findDrivers(input);
    return drivers[0] ?? null;
  }
}

export const matchingService = new MatchingService();