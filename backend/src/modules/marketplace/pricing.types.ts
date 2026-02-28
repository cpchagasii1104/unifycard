// backend/src/modules/marketplace/pricing.types.ts
// SPRINT 48: PRICING, PROMOÇÕES E COMISSÕES (DECLARATIVO)

export type PromotionType = 'PERCENTAGE' | 'FIXED';
export type PromotionAppliesTo = 'VARIANT' | 'CATEGORY' | 'PRODUCT';

export interface ProductPrice {
  id: string;
  tenantId: string;
  productVariantId: string;
  price: number;
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
   * Valor da promoção conforme SSOT do schema:
   * - PERCENTAGE: 0..100 (percentual)
   * - FIXED: valor em moeda (ex.: 5.00 = R$ 5,00)
   */
  value: number;
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
  price: number;
  currency?: string;
  validFrom?: Date;
  validTo?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreatePromotionInput {
  name: string;
  type: PromotionType;
  value: number;
  appliesTo: PromotionAppliesTo;
  appliesId: string;
  validFrom?: Date;
  validTo?: Date;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PriceBreakdown {
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









