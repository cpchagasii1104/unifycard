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
// Macro-visibilidade da oferta (espelho do padrão posts/demanda 0162; a LISTA de opções vem do
// transversal /audience-options, aqui só o vocabulário do substrato). Frontend NÃO cria verdade.
export type RentableVisibility = 'public' | 'connections' | 'only_me';

// Modo de aprovação de reserva (modelo Airbnb) — o DONO decide no cadastro. 'automatic' = confirma na
// hora (não esfria o negócio); 'manual' = o dono aprova cada pedido. Vocabulário GOVERNADO (CHECK físico).
export const BOOKING_APPROVAL_MODES = ['manual', 'automatic'] as const;
export type BookingApprovalMode = (typeof BOOKING_APPROVAL_MODES)[number];

// DECISION-0151 ADENDO A (2026-07-07): unidade de cobrança do ANÚNCIO — vocabulário GOVERNADO
// (fonte única; manifest + CHECK físico espelham daqui). Preço = REGISTRO puro (Δbank=0).
// 2026-07-08 (Fase 1): + por_semestre, por_ano (governado; CHECK físico espelha daqui).
export const RENTAL_PRICING_UNITS = ['por_hora', 'por_dia', 'por_semana', 'por_mes', 'por_semestre', 'por_ano'] as const;
export type RentalPricingUnit = (typeof RENTAL_PRICING_UNITS)[number];

// Duração canônica de cada unidade em HORAS — parte da definição do vocabulário (fonte única; a
// estimativa de preço COMPÕE daqui, não replica). Mês=30d, semestre=180d, ano=365d.
export const RENTAL_PRICING_UNIT_HOURS: Record<RentalPricingUnit, number> = {
  por_hora: 1, por_dia: 24, por_semana: 168, por_mes: 720, por_semestre: 4320, por_ano: 8760,
};

// Faixa de preço anunciado (uma por unidade). Dinheiro SEMPRE cents/BIGINT — nunca reais/float.
export interface RentalPricingTier {
  unit: RentalPricingUnit;
  priceCents: number;
}

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
  visibility: RentableVisibility;
  audienceRelationshipTypes: string[] | null;
  quantity: number;
  bookingApprovalMode: BookingApprovalMode;
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
  quantity?: number | null;
  booking_approval_mode?: BookingApprovalMode | null;
  resource_year: number | null;
  metadata: Record<string, unknown> | null;
  visibility: RentableVisibility;
  audience_relationship_types: string[] | null;
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
  visibility?: RentableVisibility;
  audienceRelationshipTypes?: string[] | null;
  cityId?: string | null; // localização governada (SSOT cities). Vínculo via address_assignments.
  postalCode?: string | null; // CEP (opcional) — refina coord via provider; sem rede usa a cidade.
  pricingTiers?: RentalPricingTier[]; // faixas de preço anunciado (SSOT rental_resource_pricing).
  quantity?: number; // unidades da oferta (equipment pode >1; veículo/imóvel/espaço = 1).
  bookingApprovalMode?: BookingApprovalMode; // Airbnb: dono decide auto/manual no cadastro.
}

export interface ListRentableResourcesFilters {
  ownerActorId?: string;
  status?: RentableResourceStatus;
  limit?: number;
  offset?: number;
}
