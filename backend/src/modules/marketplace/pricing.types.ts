// backend/src/modules/marketplace/pricing.types.ts
// SPRINT 48: PRICING, PROMOÇÕES E COMISSÕES (DECLARATIVO)
// §4.7 centavos (_cents + BIGINT no BD); §4.8 percentuais (_bps); §4.11 enums lowercase; §5.2 camelCase no domínio.

export type PromotionType = 'percentage' | 'fixed';
export type PromotionAppliesTo = 'variant' | 'category' | 'product';

export interface ProductPrice {
  id: string;
  tenantId: string;
  productVariantId: string;
  /** Preço base em centavos (§4.7). */
  priceCents: number;
  currency: string;
  validFrom: Date;
  validTo: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  type: PromotionType;
  /**
   * Desconto fixo em centavos (§4.7). Sempre 0 quando `type === 'percentage'`.
   * Cálculo de desconto apenas em `PricingService` (não somar com `discountRateBps`).
   */
  discountFixedCents: number;
  /**
   * Taxa em basis points (§4.8). 100 = 1%, 1000 = 10%. Sempre 0 quando `type === 'fixed'`.
   * Desconto percentual: floor(remainingCents * discountRateBps / 10000).
   */
  discountRateBps: number;
  appliesTo: PromotionAppliesTo;
  appliesId: string;
  validFrom: Date;
  validTo: Date | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPriceInput {
  productVariantId: string;
  priceCents: number;
  currency?: string;
  validFrom?: Date;
  validTo?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreatePromotionInput {
  name: string;
  type: PromotionType;
  /** §4.7 — com `type: 'fixed'`. Omitir ou 0 com `percentage`. */
  discountFixedCents?: number;
  /** §4.8 — com `type: 'percentage'`. Omitir ou 0 com `fixed`. */
  discountRateBps?: number;
  appliesTo: PromotionAppliesTo;
  appliesId: string;
  validFrom?: Date;
  validTo?: Date;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PriceBreakdown {
  /** Valores em unidade de moeda (ex.: reais) para snapshot em pedido / API. */
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
  currency: string;
  promotions: Array<{
    promotionId: string;
    promotionName: string;
    discountAmount: number;
    reason: string;
  }>;
}

export interface PricingContext {
  variantId: string;
  productId?: string;
  categoryId?: string;
  quantity?: number;
  userId?: string;
  date?: Date;
}
