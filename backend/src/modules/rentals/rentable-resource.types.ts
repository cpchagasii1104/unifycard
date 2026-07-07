// backend/src/modules/rentals/rentable-resource.types.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151 Opção B, FASE 2a substrato já vivo desde
// 20260624120000). Esta fatia só adiciona a SUPERFÍCIE HTTP sobre `rentable_resources` — o registro
// do recurso alugável. Availability/booking/confirm JÁ são genéricos por owner_type e não mudam aqui
// (POST /availability + POST /bookings + PUT /bookings/:id já aceitam 'rentable_resource').

// 'other' REMOVIDO (2026-07-07, GO Clayton): "Outros" é anti-padrão de ontologia (balde de
// exceções + fallback catálogo-inteiro, mesma classe do vazamento Motoboy). 5º tipo genuíno entra
// por RFC (teste de redução ontológica), nunca por balde. Estes 4 são mutuamente exclusivos e
// representam a NATUREZA do recurso (não o uso).
export type RentableResourceType = 'equipment' | 'vehicle' | 'property' | 'space';
export type RentableResourceStatus = 'active' | 'paused' | 'retired';

// DECISION-0151 ADENDO A (2026-07-07): unidade de cobrança do ANÚNCIO — vocabulário GOVERNADO
// (fonte única; manifest + CHECK físico espelham daqui). Preço = REGISTRO puro (Δbank=0).
export const RENTAL_PRICING_UNITS = ['por_hora', 'por_dia', 'por_semana', 'por_mes'] as const;
export type RentalPricingUnit = (typeof RENTAL_PRICING_UNITS)[number];

// 2026-07-07 (Clayton: "primeiro seleciono o tipo, aí sim vem a categoria relacionada" — mesma
// lógica do motor de demanda/grupos): tipo → N0 GOVERNADO congelado (doc 18). N0 bens-imoveis
// RATIFICADO por Clayton (RFC_N0_IMOVEIS_E_PROPRIEDADES.md v2). TODO tipo tem domínio NÃO-vazio —
// não existe mais fallback catálogo-inteiro (era o 'other', removido).
export const RESOURCE_TYPE_TO_DOMAINS: Record<RentableResourceType, string[]> = {
  equipment: ['produtos-e-comercio'],
  vehicle: ['mobilidade-e-logistica'],
  // 'space' (salão/chácara/galpão-evento) É bens-imoveis com o CONTEXT 'eventos' — mesma
  // identidade ontológica de 'property', não domínio separado (achado da revisão: "espaço para
  // eventos" é uso, não natureza). Concepts de espaço-evento chegam por RFC F-RENTAL-ESPACOS-E-EVENTOS.
  property: ['bens-imoveis'],
  space: ['bens-imoveis'],
};

export interface RentableResource {
  id: string;
  tenantId: string;
  ownerActorId: string;
  conceptId: string;
  resourceType: RentableResourceType;
  label: string;
  description: string | null;
  categoryId: string | null;
  pricingUnit: RentalPricingUnit | null;
  priceCents: number | null;
  resourceYear: number | null;
  metadata: Record<string, unknown>;
  status: RentableResourceStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RentableResourceRow {
  id: string;
  tenant_id: string;
  owner_actor_id: string;
  concept_id: string;
  resource_type: RentableResourceType;
  label: string;
  description: string | null;
  category_id: string | null;
  pricing_unit: RentalPricingUnit | null;
  price_cents: string | number | null;
  resource_year: number | null;
  metadata: Record<string, unknown> | null;
  status: RentableResourceStatus;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRentableResourceInput {
  conceptId: string;
  resourceType: RentableResourceType;
  label: string;
  description?: string | null;
  categoryId?: string | null;
  pricingUnit?: RentalPricingUnit | null;
  priceCents?: number | null;
  resourceYear?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ListRentableResourcesFilters {
  ownerActorId?: string;
  status?: RentableResourceStatus;
  limit?: number;
  offset?: number;
}
