"use strict";
// src/modules/rides/services/pricing.service.ts
//
// Serviço oficial de precificação do módulo Rides.
// Usado por:
//   - lifecycle.complete
//   - /pricing/estimate
//   - dashboards
//
// Integra:
//   - rides_pricing_config
//   - rides_surge_multipliers
//   - rides_zone_incentives
//   - geography: identificar zona
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingService = void 0;
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
class PricingService {
    async getActiveConfig(tenantId) {
        const rows = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_pricing_config
        WHERE is_active = TRUE
        ORDER BY updatedAt DESC
        LIMIT 1;
      `,
        });
        if (rows.length === 0) {
            throw new errors_1.BadRequestError("Pricing config missing");
        }
        return rows[0];
    }
    async getSurgeMultiplier(tenantId, lat, lng) {
        const rows = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT multiplier
        FROM rides_surge_multipliers
        WHERE zone_id = (
          SELECT zone_id
          FROM rides_zones
          WHERE ST_Contains(boundary, ST_Point($1, $2))
          LIMIT 1
        )
        AND (active_until IS NULL OR active_until > NOW())
        ORDER BY active_from DESC
        LIMIT 1;
      `,
            values: [lng, lat],
        });
        return rows[0]?.multiplier ?? 1;
    }
    async getActiveIncentives(tenantId, lat, lng) {
        const rows = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT incentive_value as valueCents
        FROM rides_zone_incentives
        WHERE zone_id = (
          SELECT zone_id
          FROM rides_zones
          WHERE ST_Contains(boundary, ST_Point($1, $2))
          LIMIT 1
        )
        AND (active_until IS NULL OR active_until > NOW());
      `,
            values: [lng, lat],
        });
        return rows.reduce((sum, r) => sum + Number(r.valueCents), 0);
    }
    async calculate(input) {
        const { tenantId, distanceKm, durationMinutes, waitTimeSeconds = 0, } = input;
        // 1. configs
        const config = await this.getActiveConfig(tenantId);
        // 2. surge (precisa do ponto inicial → lifecycle envia)
        // Por enquanto assumimos surge = 1 (rotas devem passar origin).
        const surge = 1;
        const baseFare = Number(config.base_fare);
        const distanceCost = distanceKm * Number(config.cost_per_km);
        const timeCost = durationMinutes * Number(config.cost_per_minute);
        // custo bruto
        let subtotal = baseFare + distanceCost + timeCost;
        // aplicar surge
        subtotal *= surge;
        // aplicar mínimo
        const subtotalWithMin = Math.max(subtotal, Number(config.minimum_fare));
        // incentivos (zona, pressão)
        const incentive = 0; // matching/demand podem injetar isso futuramente
        const finalFareBeforeTip = subtotalWithMin + incentive;
        return {
            totalCents: finalFareBeforeTip,
            baseFare,
            distanceCost,
            timeCost,
            minimumFare: config.minimum_fare,
            surgeMultiplier: surge,
            incentiveAmount: incentive,
            platformFeePercent: config.platform_fee_percent ?? 15,
            communityFeePercent: config.community_fee_percent ?? 2,
            finalFareBeforeTip,
        };
    }
}
exports.pricingService = new PricingService();
