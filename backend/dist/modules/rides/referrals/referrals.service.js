"use strict";
// src/modules/rides/referrals/referrals.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralsService = exports.ReferralsService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const crypto_1 = __importDefault(require("crypto"));
class ReferralsService {
    // ============================================================================
    // 🔹 1. Gerar código de indicação do motorista
    // ============================================================================
    async generateDriverReferralCode(tenantId, driverId) {
        const existing = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT referral_code
      FROM rides_drivers
      WHERE tenant_id = $1 AND driver_id = $2
      `,
            values: [tenantId, driverId],
        });
        if (existing?.referral_code)
            return existing.referral_code;
        const newCode = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_drivers
      SET referral_code = $3
      WHERE tenant_id = $1 AND driver_id = $2
      `,
            values: [tenantId, driverId, newCode],
        });
        return newCode;
    }
    // ============================================================================
    // 🔹 2. Aplicar código de indicação ao passageiro no cadastro
    // ============================================================================
    async applyReferralCode(tenantId, userId, promoCode) {
        const driver = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT driver_id
      FROM rides_drivers
      WHERE tenant_id = $1
        AND UPPER(referral_code) = UPPER($2)
      `,
            values: [tenantId, promoCode],
        });
        if (!driver) {
            throw new errors_1.BadRequestError('Código de indicação inválido.');
        }
        // Inserir relação (quem indicou quem)
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_referral_links (
        tenant_id, referred_user_id, referrer_driver_id, createdAt
      )
      VALUES ($1,$2,$3, now())
      ON CONFLICT (tenant_id, referred_user_id) DO NOTHING
      `,
            values: [tenantId, userId, driver.driver_id],
        });
        return {
            ok: true,
            referrerDriverId: driver.driver_id,
        };
    }
    // ============================================================================
    // 🔹 3. Registrar bônus de indicação após corrida
    // ============================================================================
    async registerRideReferralBonus(tenantId, rideId, passengerId, totalAmount) {
        // Procurar quem indicou esse passageiro
        const ref = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT referrer_driver_id
      FROM rides_referral_links
      WHERE tenant_id = $1 AND referred_user_id = $2
      `,
            values: [tenantId, passengerId],
        });
        if (!ref)
            return null; // Não há indicação -> nada a fazer
        // Buscar regras de distribuição
        const rules = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT referral_pct
      FROM rides_distribution_rules
      WHERE tenant_id = $1
      LIMIT 1
      `,
            values: [tenantId],
        });
        if (!rules)
            return null;
        const pct = Number(rules.referral_pct || 0);
        if (pct <= 0)
            return null;
        const reward = totalAmount * pct;
        // Registrar ganho de referral
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_referral_earnings (
        tenant_id, referrer_driver_id, ride_id, amount, createdAt
      )
      VALUES ($1,$2,$3,$4, now())
      `,
            values: [tenantId, ref.referrer_driver_id, rideId, reward],
        });
        // Emitir evento
        await event_bus_1.eventBus.emit({
            type: 'rides.referral.reward',
            tenantId,
            payload: {
                driverId: ref.referrer_driver_id,
                reward,
                rideId,
            },
        });
        return {
            referrerDriverId: ref.referrer_driver_id,
            reward,
        };
    }
    // ============================================================================
    // 🔹 4. Listar ganhos de referral de um motorista
    // ============================================================================
    async listDriverReferralEarnings(tenantId, driverId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_referral_earnings
      WHERE tenant_id = $1 AND referrer_driver_id = $2
      ORDER BY createdAt DESC
      `,
            values: [tenantId, driverId],
        });
    }
    // ============================================================================
    // 🔹 5. Contagem total de ganhos por indicação
    // ============================================================================
    async getDriverReferralSummary(tenantId, driverId) {
        return (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT 
        COALESCE(SUM(amount), 0) AS total_earnings,
        COUNT(*) AS total_rides
      FROM rides_referral_earnings
      WHERE tenant_id = $1 AND referrer_driver_id = $2
      `,
            values: [tenantId, driverId],
        });
    }
}
exports.ReferralsService = ReferralsService;
exports.referralsService = new ReferralsService();
