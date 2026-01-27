"use strict";
// src/modules/rides/services/matching.service.ts
//
// Serviço de matching.
// Encapsula a lógica acima da função SQL rides_find_nearby_drivers().
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchingService = void 0;
const db_1 = require("@core/db");
class MatchingService {
    async findDrivers(input) {
        const { tenantId, lat, lng, radiusKm = 5, serviceTypeId, minCapacity = 1, limit = 20, } = input;
        const rows = await (0, db_1.runQueryWithTenant)(tenantId, {
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
        return rows.sort((a, b) => {
            if (a.can_drive && !b.can_drive)
                return -1;
            if (!a.can_drive && b.can_drive)
                return 1;
            if (a.distance_km !== b.distance_km) {
                return a.distance_km - b.distance_km;
            }
            return b.rating_avg - a.rating_avg;
        });
    }
    async pickBestDriver(input) {
        const drivers = await this.findDrivers(input);
        return drivers[0] ?? null;
    }
}
exports.matchingService = new MatchingService();
