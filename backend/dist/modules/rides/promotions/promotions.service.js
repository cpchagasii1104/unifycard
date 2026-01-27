"use strict";
// src/modules/rides/promotions/promotions.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.promotionsService = exports.PromotionsService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
class PromotionsService {
    // ============================================================================
    // 🔹 1. Criar promoção
    // ============================================================================
    async createPromotion(tenantId, data) {
        const { title, description, promo_code, discount_type, // percent | fixed
        discount_value, max_uses, starts_at, expires_at, min_distance_km, min_price, applicable_city_id, applicable_service_type_id, } = data;
        if (!title || !discount_type || !discount_value) {
            throw new errors_1.BadRequestError('Título, tipo e valor do desconto são obrigatórios.');
        }
        const result = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_promotions (
        tenant_id, title, description, promo_code,
        discount_type, discount_value, max_uses,
        starts_at, expires_at,
        min_distance_km, min_price,
        applicable_city_id, applicable_service_type_id,
        created_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()
      )
      RETURNING *
      `,
            values: [
                tenantId,
                title,
                description,
                promo_code,
                discount_type,
                discount_value,
                max_uses,
                starts_at,
                expires_at,
                min_distance_km,
                min_price,
                applicable_city_id,
                applicable_service_type_id,
            ],
        });
        if (!result) {
            throw new Error('Failed to create promotion');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.promotion.created',
            tenantId,
            payload: {
                promotionId: result.promotion_id,
            },
        });
        return result;
    }
    // ============================================================================
    // 🔹 2. Buscar promoção por código
    // ============================================================================
    async getPromotionByCode(tenantId, promoCode) {
        return (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_promotions
      WHERE tenant_id = $1
        AND LOWER(promo_code) = LOWER($2)
        AND expires_at > now()
        AND (max_uses IS NULL OR uses_count < max_uses)
      `,
            values: [tenantId, promoCode],
        });
    }
    // ============================================================================
    // 🔹 3. Validar elegibilidade
    // ============================================================================
    async validatePromotion(tenantId, promoCode, rideData) {
        const promo = await this.getPromotionByCode(tenantId, promoCode);
        if (!promo)
            throw new errors_1.NotFoundError('Promoção inválida ou expirada.');
        // Verificar cidade
        if (promo.applicable_city_id && promo.applicable_city_id !== rideData.city_id) {
            throw new errors_1.BadRequestError('Promoção não é válida para esta cidade.');
        }
        // Verificar tipo de serviço
        if (promo.applicable_service_type_id &&
            promo.applicable_service_type_id !== rideData.service_type_id) {
            throw new errors_1.BadRequestError('Promoção não é válida para este tipo de serviço.');
        }
        // Verificar valor mínimo
        if (promo.min_price && rideData.estimated_price < promo.min_price) {
            throw new errors_1.BadRequestError('Valor mínimo não atingido para aplicar promoção.');
        }
        // Verificar distância mínima
        if (promo.min_distance_km &&
            rideData.total_distance_km < promo.min_distance_km) {
            throw new errors_1.BadRequestError('Distância mínima não atingida para aplicar promoção.');
        }
        return promo;
    }
    // ============================================================================
    // 🔹 4. Aplicar desconto
    // ============================================================================
    applyDiscount(promo, price) {
        if (promo.discount_type === 'percent') {
            return Math.max(price - price * (promo.discount_value / 100), 0);
        }
        if (promo.discount_type === 'fixed') {
            return Math.max(price - promo.discount_value, 0);
        }
        return price;
    }
    // ============================================================================
    // 🔹 5. Registrar uso da promoção
    // ============================================================================
    async registerPromotionUse(tenantId, promotionId, rideId) {
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_driver_promotion_progress (
        tenant_id, promotion_id, ride_id, used_at
      )
      VALUES ($1,$2,$3,now())
      `,
            values: [tenantId, promotionId, rideId],
        });
        // Incrementar contador de usos
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_promotions
      SET uses_count = uses_count + 1
      WHERE tenant_id = $1 AND promotion_id = $2
      `,
            values: [tenantId, promotionId],
        });
        await event_bus_1.eventBus.emit({
            type: 'rides.promotion.used',
            tenantId,
            payload: {
                promotionId,
                rideId,
            },
        });
    }
    // ============================================================================
    // 🔹 6. Listar promoções disponíveis
    // ============================================================================
    async listAvailablePromotions(tenantId, cityId, serviceTypeId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_promotions
      WHERE tenant_id = $1
        AND (applicable_city_id IS NULL OR applicable_city_id = $2)
        AND (applicable_service_type_id IS NULL OR applicable_service_type_id = $3)
        AND expires_at > now()
        AND (max_uses IS NULL OR uses_count < max_uses)
      ORDER BY created_at DESC
      `,
            values: [tenantId, cityId, serviceTypeId],
        });
    }
}
exports.PromotionsService = PromotionsService;
exports.promotionsService = new PromotionsService();
