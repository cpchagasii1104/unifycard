// backend/src/modules/marketplace/pricing.service.ts
// SPRINT 48: Service para pricing, promoções e comissões

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

/**
 * Service para pricing, promoções e comissões
 * 
 * ⚠️ REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
 * - NÃO recalcular pagamento após criado
 * - NÃO alterar orders já criados
 * - Preço é resolvido ANTES do pedido
 * - Preço final é snapshot no order metadata
 */
class PricingService {
  /**
   * Obtém preço atual com promoções aplicadas
   * 
   * Retorna breakdown completo:
   * - preço base
   * - desconto aplicado
   * - preço final
   * - promoções aplicadas
   */
  async getCurrentPrice(
    tenantId: string,
    context: PricingContext
  ): Promise<PriceBreakdown> {
    const date = context.date || new Date();

    // 1. Buscar preço base da variante
    const basePrice = await productPriceRepository.getCurrentPrice(
      tenantId,
      context.variantId,
      date
    );

    if (!basePrice) {
      throw new Error(`Preço não encontrado para variante: ${context.variantId}`);
    }

    // 2. Buscar produto e categoria para aplicar promoções
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

    // 3. Buscar promoções aplicáveis
    const promotions = await promotionRepository.getApplicablePromotions(
      tenantId,
      context.variantId,
      product.id,
      product.categoryId || null,
      date
    );

    // 4. Aplicar promoções
    let finalPrice = basePrice.price;
    const appliedPromotions: PriceBreakdown['promotions'] = [];

    for (const promotion of promotions) {
      let discountAmount = 0;

      if (promotion.type === 'PERCENTAGE') {
        // Desconto percentual
        discountAmount = (basePrice.price * promotion.value) / 100;
      } else if (promotion.type === 'FIXED') {
        // Desconto fixo
        discountAmount = promotion.value;
      }

      // Não permitir desconto maior que o preço
      if (discountAmount > finalPrice) {
        discountAmount = finalPrice;
      }

      finalPrice -= discountAmount;

      appliedPromotions.push({
        promotionId: promotion.id,
        promotionName: promotion.name,
        discountAmount,
        reason: `${promotion.appliesTo}: ${promotion.appliesId}`,
      });
    }

    // Garantir que preço final não seja negativo
    if (finalPrice < 0) {
      finalPrice = 0;
    }

    return {
      basePrice: basePrice.price,
      discountAmount: basePrice.price - finalPrice,
      finalPrice,
      currency: basePrice.currency,
      promotions: appliedPromotions,
    };
  }

  /**
   * Cria preço de produto
   */
  async createPrice(
    tenantId: string,
    input: CreateProductPriceInput
  ): Promise<ProductPrice> {
    return await productPriceRepository.createPrice(tenantId, input);
  }

  /**
   * Busca preço atual de uma variante (sem promoções)
   */
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

  /**
   * Lista preços de uma variante
   */
  async listPricesByVariant(
    tenantId: string,
    variantId: string
  ): Promise<ProductPrice[]> {
    return await productPriceRepository.listPricesByVariant(tenantId, variantId);
  }

  /**
   * Cria promoção
   */
  async createPromotion(
    tenantId: string,
    input: CreatePromotionInput
  ): Promise<Promotion> {
    return await promotionRepository.createPromotion(tenantId, input);
  }

  /**
   * Lista promoções
   */
  async listPromotions(
    tenantId: string,
    isActive?: boolean
  ): Promise<Promotion[]> {
    return await promotionRepository.listPromotions(tenantId, isActive);
  }
}

export const pricingService = new PricingService();







