// backend/src/modules/asset-sale/asset-sale.types.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 — VENDA ASSET-FIRST (adendo RFC_ASSET_SALE_TERMS_ADENDO).
// Domínio da VENDA de bem durável INDIVIDUAL do actor. Identidade (concept/owner/label/condition) vem de
// actor_assets; aqui só os TERMOS comerciais (anúncio). NÃO é products/product_offers (isso é estoque PJ).

import type { AssetCondition, AssetSaleStatus } from '@core/assets/asset.types';
export type { AssetSaleStatus, AssetCondition };

// Macro-visibilidade do anúncio (mesmo vocabulário do substrato de locação; o front NÃO cria verdade).
export type AssetSaleVisibility = 'public' | 'connections' | 'only_me';

// Projeção da oferta de venda (item real + termos). condition vem do ITEM (actor_assets), nunca duplicada.
export interface AssetSaleOffer {
  assetId: string;
  tenantId: string;
  ownerActorId: string;
  conceptId: string;
  label: string;
  condition: AssetCondition | null;
  priceCents: number | null; // ANÚNCIO (Δbank=0). NULL = a combinar / negociável.
  status: AssetSaleStatus; // active/paused (D-ε; sem 'sold').
  isActive: boolean;
  visibility: AssetSaleVisibility;
  audienceRelationshipTypes: string[] | null;
  negotiable: boolean;
  saleNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetSaleInput {
  conceptId: string; // concept DURÁVEL (gate concept_asset_eligibilities). NÃO SKU/perecível.
  label: string;
  condition?: AssetCondition | null; // do ITEM (actor_assets.condition). NULL permitido.
  priceCents?: number | null; // anúncio. NULL = a combinar.
  visibility?: AssetSaleVisibility;
  audienceRelationshipTypes?: string[] | null;
  negotiable?: boolean;
  saleNotes?: string | null;
}
