// backend/src/modules/demands/demand.types.ts
// DECISION-0164 — substrato de DEMANDA de serviço (fatia A do motor de orquestração).
// Vocabulários GOVERNADOS (fonte única; espelham os CHECKs de 20260707120000).
// FRONTEIRAS: Δbank=0 (valores = REGISTRO do combinado; mover dinheiro = PORTA-1);
// relação ≠ autoridade; catraca 0113 nas rotas.

export const DEMAND_VINCULOS = ['diaria', 'periodo', 'recorrente', 'efetivo'] as const;
export type DemandVinculo = (typeof DEMAND_VINCULOS)[number];

export const DEMAND_ACCEPTANCE_MODES = ['automatico', 'com_analise'] as const;
export type DemandAcceptanceMode = (typeof DEMAND_ACCEPTANCE_MODES)[number];

export const DEMAND_PRICING_MODES = ['preco_ofertado', 'orcamento'] as const;
export type DemandPricingMode = (typeof DEMAND_PRICING_MODES)[number];

export const DEMAND_STATUSES = ['open', 'filled', 'closed', 'cancelled'] as const;
export type DemandStatus = (typeof DEMAND_STATUSES)[number];

export const DEMAND_RESPONSE_STATUSES = ['pending', 'accepted', 'chosen', 'rejected', 'withdrawn'] as const;
export type DemandResponseStatus = (typeof DEMAND_RESPONSE_STATUSES)[number];

export interface ServiceDemand {
  id: string;
  tenantId: string;
  actorId: string;
  conceptId: string;
  conceptSlug?: string;
  title: string;
  description: string | null;
  vinculo: DemandVinculo;
  quantity: number;
  quantityFilled: number;
  dateStart: string | null;
  dateEnd: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  weekdays: number[] | null;
  radiusKm: number | null;
  /** intervalo na jornada em minutos; NULL = direto (sem intervalo) */
  breakMinutes: number | null;
  acceptanceMode: DemandAcceptanceMode;
  pricingMode: DemandPricingMode;
  offeredPriceCents: number | null;
  cancelNoticeHours: number | null;
  visibility: 'public' | 'connections';
  audienceRelationshipTypes: string[] | null;
  status: DemandStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDemandInput {
  conceptId?: string;
  conceptSlug?: string;
  title: string;
  description?: string;
  vinculo: DemandVinculo;
  quantity?: number;
  dateStart?: string;
  dateEnd?: string;
  timeStart?: string;
  timeEnd?: string;
  weekdays?: number[];
  radiusKm?: number;
  breakMinutes?: number;
  acceptanceMode?: DemandAcceptanceMode;
  pricingMode?: DemandPricingMode;
  offeredPriceCents?: number;
  cancelNoticeHours?: number;
  visibility?: 'public' | 'connections';
  /** Espelho 0162: refinamento por tipo de relação (⊆ typed-edge; exige visibility='connections'). */
  audienceRelationshipTypes?: string[];
}

export interface DemandResponse {
  id: string;
  tenantId: string;
  demandId: string;
  providerActorId: string;
  providerDisplayName?: string;
  status: DemandResponseStatus;
  quoteCents: number | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}
