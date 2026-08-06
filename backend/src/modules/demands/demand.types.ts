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
  /** DECISION-0196 §H — a NECESSIDADE do evento que este pedido atende. NULL = demanda avulsa.
   *  NÃO carrega valor (§H.2: o preço mora na RESPOSTA; a F3 agrega de baixo para cima). */
  needId: string | null;
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
  /** DECISION-0196 §H — liga o pedido à NECESSIDADE do evento (`event_operational_needs.id`).
   *  Opcional: ausente = demanda avulsa. O writer RECUSA need de outro tenant (0146 §A.6). */
  needId?: string | null;
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
  /** DECISION-0196 §C/D1 — até quando esta resposta vale. NUNCA null (coluna NOT NULL). */
  expiresAt: string;
  /** DECISION-0196 §C/D1 — DERIVADO na leitura pelo leitor único; nunca gravado. */
  isExpired: boolean;
  /** DECISION-0196 §B.2 — o que está sendo ofertado: offering XOR asset, nunca os dois. */
  offeringId: string | null;
  assetId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DECISION-0196 §C/D1 — validade padrão do orçamento.
 * 🔴 Injetado NA ESCRITA, nunca como default de banco: default de banco deixa o writer esquecer em
 * silêncio, e foi assim que `actor_active_location.expires_at` virou prazo decorativo
 * (`DT-EXPIRY-DOOR-WITHOUT-TRIGGER`, 2026-08-05). Aqui a omissão FALHA ALTO (NOT NULL sem default).
 * ⚠️ "configurável POR OFERTA" é a decisão; a casa dessa configuração ainda NÃO existe — quando
 * existir, ela entra AQUI, e esta constante vira o fallback. Nomeado para não virar hardcode órfão.
 */
export const DEMAND_QUOTE_DEFAULT_VALIDITY_DAYS = 7;
