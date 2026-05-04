// backend/src/modules/marketplace/attribution.service.ts
// Módulo isolado de Attribution
// Extraído de marketplace.service.ts para reduzir acoplamento

import type { CheckoutIntent } from '@contracts/marketplace';

type Attribution = {
  attribution_id: string;
  source: {
    type: 'user' | 'group' | 'page' | 'store';
    id: string;
  };
  intent: 'business' | 'recommendation' | 'entertainment';
  visibility: {
    scope: 'public' | 'group' | 'direct' | 'relationship_category';
    group_id?: string;
    target_ids?: string[];
    relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
  };
  commission?: {
    type: 'percentage' | 'fixed';
    valueCents: number;
  };
  createdAt: string;
};

export class AttributionService {
  constructor(
    private attributions: Map<string, Attribution>,
    private checkouts: Map<string, CheckoutIntent>
  ) {}

  /**
   * Buscar attribution por ID
   */
  getAttribution(attributionId: string): Attribution | null {
    return this.attributions.get(attributionId) || null;
  }

  /**
   * Associar attribution_id ao checkout (se vier de share)
   */
  associateAttributionToCheckout(checkoutId: string, attributionId: string): void {
    const checkout = this.checkouts.get(checkoutId);
    if (checkout) {
      (checkout as any).attribution_id = attributionId;
      this.checkouts.set(checkoutId, checkout);
    }
  }
}







