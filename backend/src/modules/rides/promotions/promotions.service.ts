// src/modules/rides/promotions/promotions.service.ts

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from '@core/db';
import { publishRideEventOutbox } from '../shared/publish-ride-event';
import { BadRequestError, NotFoundError } from '@core/errors';

export class PromotionsService {

  // ============================================================================
  // 🔹 1. Criar promoção
  // ============================================================================
  async createPromotion(tenantId: string, data: any) {
    const {
      title,
      description,
      promo_code,
      discount_type,     // percent | fixed
      discount_value,
      max_uses,
      startsAt,
      expiresAt,
      min_distance_km,
      min_price,
      applicable_city_id,
      applicable_service_type_id,
    } = data;

    if (!title || !discount_type || !discount_value) {
      throw new BadRequestError('Título, tipo e valor do desconto são obrigatórios.');
    }

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
      INSERT INTO rides_promotions (
        tenant_id, title, description, promo_code,
        discount_type, discount_value, max_uses,
        startsAt, expiresAt,
        min_distance_km, min_price,
        applicable_city_id, applicable_service_type_id,
        created_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()
      )
      RETURNING *
      `,
        [
          tenantId,
          title,
          description,
          promo_code,
          discount_type,
          discount_value,
          max_uses,
          startsAt,
          expiresAt,
          min_distance_km,
          min_price,
          applicable_city_id,
          applicable_service_type_id,
        ]
      );
      const result = res.rows[0];
      if (!result) {
        throw new Error('Failed to create promotion');
      }
      await publishRideEventOutbox(client, {
        type: 'rides.promotion.created',
        tenantId,
        payload: {
          promotionId: result.promotion_id,
        },
      });
      return result;
    });
  }

  // ============================================================================
  // 🔹 2. Buscar promoção por código
  // ============================================================================
  async getPromotionByCode(tenantId: string, promoCode: string) {
    return runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_promotions
      WHERE tenant_id = $1
        AND LOWER(promo_code) = LOWER($2)
        AND expiresAt > now()
        AND (max_uses IS NULL OR uses_count < max_uses)
      `,
        values: [tenantId, promoCode],
      }
    );
  }

  // ============================================================================
  // 🔹 3. Validar elegibilidade
  // ============================================================================
  async validatePromotion(tenantId: string, promoCode: string, rideData: any) {
    const promo = await this.getPromotionByCode(tenantId, promoCode);

    if (!promo) throw new NotFoundError('Promoção inválida ou expirada.');

    // Verificar cidade
    if (promo.applicable_city_id && promo.applicable_city_id !== rideData.city_id) {
      throw new BadRequestError('Promoção não é válida para esta cidade.');
    }

    // Verificar tipo de serviço
    if (
      promo.applicable_service_type_id &&
      promo.applicable_service_type_id !== rideData.service_type_id
    ) {
      throw new BadRequestError('Promoção não é válida para este tipo de serviço.');
    }

    // Verificar valor mínimo
    if (promo.min_price && rideData.estimated_price < promo.min_price) {
      throw new BadRequestError('Valor mínimo não atingido para aplicar promoção.');
    }

    // Verificar distância mínima
    if (
      promo.min_distance_km &&
      rideData.total_distance_km < promo.min_distance_km
    ) {
      throw new BadRequestError('Distância mínima não atingida para aplicar promoção.');
    }

    return promo;
  }

  // ============================================================================
  // 🔹 4. Aplicar desconto
  // ============================================================================
  applyDiscount(promo: any, price: number): number {
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
  async registerPromotionUse(tenantId: string, promotionId: string, rideId: string) {
    await runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
      INSERT INTO rides_driver_promotion_progress (
        tenant_id, promotion_id, ride_id, usedAt
      )
      VALUES ($1,$2,$3,now())
      `,
        [tenantId, promotionId, rideId]
      );

      await client.query(
        `
      UPDATE rides_promotions
      SET uses_count = uses_count + 1
      WHERE tenant_id = $1 AND promotion_id = $2
      `,
        [tenantId, promotionId]
      );

      await publishRideEventOutbox(client, {
        type: 'rides.promotion.used',
        tenantId,
        payload: {
          promotionId,
          rideId,
        },
      });
    });
  }

  // ============================================================================
  // 🔹 6. Listar promoções disponíveis
  // ============================================================================
  async listAvailablePromotions(tenantId: string, cityId: string, serviceTypeId: string) {
    return runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_promotions
      WHERE tenant_id = $1
        AND (applicable_city_id IS NULL OR applicable_city_id = $2)
        AND (applicable_service_type_id IS NULL OR applicable_service_type_id = $3)
        AND expiresAt > now()
        AND (max_uses IS NULL OR uses_count < max_uses)
      ORDER BY created_at DESC
      `,
        values: [tenantId, cityId, serviceTypeId],
      }
    );
  }
}

export const promotionsService = new PromotionsService();

