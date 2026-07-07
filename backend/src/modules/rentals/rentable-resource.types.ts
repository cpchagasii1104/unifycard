// backend/src/modules/rentals/rentable-resource.types.ts
// F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151 Opção B, FASE 2a substrato já vivo desde
// 20260624120000). Esta fatia só adiciona a SUPERFÍCIE HTTP sobre `rentable_resources` — o registro
// do recurso alugável. Availability/booking/confirm JÁ são genéricos por owner_type e não mudam aqui
// (POST /availability + POST /bookings + PUT /bookings/:id já aceitam 'rentable_resource').

export type RentableResourceType = 'equipment' | 'vehicle' | 'property' | 'space' | 'other';
export type RentableResourceStatus = 'active' | 'paused' | 'retired';

// DECISION-0151 ADENDO A (2026-07-07): unidade de cobrança do ANÚNCIO — vocabulário GOVERNADO
// (fonte única; manifest + CHECK físico espelham daqui). Preço = REGISTRO puro (Δbank=0).
export const RENTAL_PRICING_UNITS = ['por_hora', 'por_dia', 'por_semana', 'por_mes'] as const;
export type RentalPricingUnit = (typeof RENTAL_PRICING_UNITS)[number];

// 2026-07-07 (Clayton: "primeiro seleciono o tipo, aí sim vem a categoria relacionada" — mesma
// lógica do motor de demanda/grupos): tipo → N0 GOVERNADO congelado (doc 18). 'property' fica FORA
// (sem N0 — RFC_N0_IMOVEIS_E_PROPRIEDADES.md aguarda ratificação); 'other' fica sem filtro (aberto).
export const RESOURCE_TYPE_TO_DOMAINS: Record<RentableResourceType, string[] | null> = {
  equipment: ['produtos-e-comercio'],
  vehicle: ['mobilidade-e-logistica'],
  property: [], // bloqueado de propósito — sem N0 ainda
  space: [],    // idem property — mesmo gap (imóvel/espaço)
  other: null,  // null = catálogo inteiro (recurso atípico, sem domínio único)
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
