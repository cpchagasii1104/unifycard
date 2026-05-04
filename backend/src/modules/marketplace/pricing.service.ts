// backend/src/modules/marketplace/pricing.service.ts
// SPRINT 48: Service para pricing, promoções e comissões — §4.7 / §4.8 / §4.11

import { BadRequestError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import { productPriceRepository } from './product-price.repository';
import { promotionRepository } from './promotion.repository';
import { productVariantRepository } from './product-variant.repository';
import { productRepository } from './product.repository';
import type {
  PriceBreakdown,
  PricingContext,
  CreateProductPriceInput,
  CreatePromotionInput,
  ProductPrice,
  Promotion,
} from './pricing.types';

/** Desconto em centavos (único interpretador de discount_fixed_cents + discount_rate_bps). */
function promotionDiscountCents(remainingCents: number, promotion: Promotion): number {
  if (promotion.type === 'percentage') {
    return Math.floor((remainingCents * promotion.discountRateBps) / 10000);
  }
  return Math.min(promotion.discountFixedCents, remainingCents);
}

function assertCreatePromotionInput(input: CreatePromotionInput): void {
  const fixed = input.discountFixedCents ?? 0;
  const bps = input.discountRateBps ?? 0;

  if (input.type === 'fixed') {
    if (!Number.isFinite(fixed) || fixed < 0 || !Number.isInteger(fixed)) {
      throw new BadRequestError(
        'discountFixedCents deve ser inteiro ≥ 0 (§4.7)',
        ErrorCode.VALIDATION_ERROR
      );
    }
    if (bps !== 0) {
      throw new BadRequestError(
        'type fixed exige discountRateBps = 0 (§4.8 separado de centavos)',
        ErrorCode.VALIDATION_ERROR
      );
    }
  } else {
    if (!Number.isFinite(bps) || !Number.isInteger(bps) || bps < 0 || bps > 10000) {
      throw new BadRequestError(
        'discountRateBps deve ser inteiro entre 0 e 10000 (basis points, §4.8)',
        ErrorCode.VALIDATION_ERROR
      );
    }
    if (fixed !== 0) {
      throw new BadRequestError(
        'type percentage exige discountFixedCents = 0 (§4.7)',
        ErrorCode.VALIDATION_ERROR
      );
    }
  }
}

class PricingService {
  async getCurrentPrice(
    tenantId: string,
    context: PricingContext
  ): Promise<PriceBreakdown> {
    const date = context.date || new Date();

    const basePrice = await productPriceRepository.getCurrentPrice(
      tenantId,
      context.variantId,
      date
    );

    if (!basePrice) {
      throw new Error(`Preço não encontrado para variante: ${context.variantId}`);
    }

    const variant = await productVariantRepository.getVariantById(
      tenantId,
      context.variantId
    );
    if (!variant) {
      throw new Error(`Variante não encontrada: ${context.variantId}`);
    }

    const product = await productRepository.getProductById(
      tenantId,
      variant.productId
    );
    if (!product) {
      throw new Error(`Produto não encontrado: ${variant.productId}`);
    }

    const promotions = await promotionRepository.getApplicablePromotions(
      tenantId,
      context.variantId,
      product.id,
      product.categoryId || null,
      date
    );

    let remainingCents = basePrice.priceCents;
    const appliedPromotions: PriceBreakdown['promotions'] = [];

    for (const promotion of promotions) {
      let discountCents = promotionDiscountCents(remainingCents, promotion);
      if (discountCents > remainingCents) {
        discountCents = remainingCents;
      }
      remainingCents -= discountCents;

      appliedPromotions.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        discountAmount: discountCents / 100,
        reason: `${promotion.appliesTo}: ${promotion.appliesId}`,
      });
    }

    if (remainingCents < 0) {
      remainingCents = 0;
    }

    const baseCents = basePrice.priceCents;
    return {
      basePrice: baseCents / 100,
      discountAmount: (baseCents - remainingCents) / 100,
      finalPrice: remainingCents / 100,
      currency: basePrice.currency,
      promotions: appliedPromotions,
    };
  }

  async createPrice(
    tenantId: string,
    input: CreateProductPriceInput
  ): Promise<ProductPrice> {
    return await productPriceRepository.createPrice(tenantId, input);
  }

  async getBasePrice(
    tenantId: string,
    variantId: string,
    date?: Date
  ): Promise<ProductPrice | null> {
    return await productPriceRepository.getCurrentPrice(
      tenantId,
      variantId,
      date || new Date()
    );
  }

  async listPricesByVariant(
    tenantId: string,
    variantId: string
  ): Promise<ProductPrice[]> {
    return await productPriceRepository.listPricesByVariant(tenantId, variantId);
  }

  async createPromotion(
    tenantId: string,
    input: CreatePromotionInput
  ): Promise<Promotion> {
    assertCreatePromotionInput(input);
    return await promotionRepository.createPromotion(tenantId, input);
  }

  async listPromotions(
    tenantId: string,
    isActive?: boolean
  ): Promise<Promotion[]> {
    return await promotionRepository.listPromotions(tenantId, isActive);
  }
}

export const pricingService = new PricingService();
