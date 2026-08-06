// frontend/src/api/demands.ts
// DECISION-0164 fatia B — client do motor de demanda. A tela PROJETA; o servidor decide
// (catraca 0113, vocabulários governados, vagas atômicas). Valores = registro (PORTA-1).

import { apiFetchJson } from './client';

export interface ServiceDemand {
  id: string;
  actorId: string;
  conceptId: string;
  conceptSlug?: string;
  title: string;
  description: string | null;
  vinculo: 'diaria' | 'periodo' | 'recorrente' | 'efetivo';
  quantity: number;
  quantityFilled: number;
  dateStart: string | null;
  dateEnd: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  weekdays: number[] | null;
  radiusKm: number | null;
  breakMinutes: number | null;
  acceptanceMode: 'automatico' | 'com_analise';
  pricingMode: 'preco_ofertado' | 'orcamento';
  offeredPriceCents: number | null;
  cancelNoticeHours: number | null;
  visibility: string;
  status: 'open' | 'filled' | 'closed' | 'cancelled';
  /** DECISION-0196 §H — a NECESSIDADE do evento que este pedido atende. null = demanda avulsa.
   *  NÃO carrega valor (§H.2: o preço vive na RESPOSTA). */
  needId: string | null;
  /** DECISION-0196 §G.1/§C-D4 — pedido DIRIGIDO a um actor. null = broadcast. MESMA entidade. */
  targetActorId: string | null;
  createdAt: string;
}

export interface DemandResponse {
  id: string;
  demandId: string;
  providerActorId: string;
  providerDisplayName?: string;
  status: 'pending' | 'accepted' | 'chosen' | 'rejected' | 'withdrawn';
  quoteCents: number | null;
  message: string | null;
  // 🔴 ESPELHO DO CONTRATO (07_NOMENCLATURA §7: o frontend espelha EXATAMENTE a API, não inventa
  // nem omite). Estes 4 campos existem na resposta desde a F1 (DECISION-0196 §B.2/§C) e o tipo
  // daqui não os declarava — o compilador não podia defender nenhuma tela que dependesse deles,
  // e a validade do orçamento ficava invisível para a UI. Declarados em 2026-08-06.
  // ⚠️ Declarar ≠ exibir: mostrar validade/oferta é trabalho da F4, não deste espelho.
  /** DECISION-0196 §C/D1 — até quando esta resposta vale. NUNCA null (coluna NOT NULL). */
  expiresAt: string;
  /** Derivado na leitura pelo LEITOR ÚNICO do backend — nunca recalcule no cliente. */
  isExpired: boolean;
  /** §B.2 — o que está sendo ofertado: oferta XOR ativo, ambos opcionais (§B.4 emendada). */
  offeringId: string | null;
  assetId: string | null;
  createdAt: string;
}

export interface CreateDemandInput {
  conceptSlug: string;
  title: string;
  description?: string;
  vinculo: ServiceDemand['vinculo'];
  quantity?: number;
  dateStart?: string;
  dateEnd?: string;
  timeStart?: string;
  timeEnd?: string;
  weekdays?: number[];
  radiusKm?: number;
  breakMinutes?: number;
  acceptanceMode?: ServiceDemand['acceptanceMode'];
  pricingMode?: ServiceDemand['pricingMode'];
  offeredPriceCents?: number;
  cancelNoticeHours?: number;
  visibility?: 'public' | 'connections';
  audienceRelationshipTypes?: string[];
  /** DECISION-0196 §H — liga o pedido à NECESSIDADE do evento. Ausente = demanda avulsa.
   *  ⚠️ O servidor RECUSA need de outro tenant (DEMAND_NEED_NOT_IN_TENANT) — a trava é dele. */
  needId?: string | null;
  /** DECISION-0196 §G.1 — a quem o pedido é DIRIGIDO. Ausente = broadcast.
   *  ⚠️ O servidor recusa alvo de outro tenant e a si mesmo — a trava é dele, não daqui. */
  targetActorId?: string | null;
}

export async function listWorkConcepts(): Promise<Array<{ concept_id: string; slug: string; domain: string; label?: string | null }>> {
  const r = await apiFetchJson<{ data: Array<{ concept_id: string; slug: string; domain: string; label?: string | null }> }>('/demands/concepts');
  return r.data ?? [];
}

export async function createDemand(input: CreateDemandInput): Promise<ServiceDemand> {
  const r = await apiFetchJson<{ data: ServiceDemand }>('/demands', { method: 'POST', body: JSON.stringify(input) });
  return r.data;
}

export async function listMyDemands(): Promise<ServiceDemand[]> {
  const r = await apiFetchJson<{ data: ServiceDemand[] }>('/demands/mine');
  return r.data ?? [];
}

export async function listOpportunities(onlyMatching: boolean): Promise<ServiceDemand[]> {
  const r = await apiFetchJson<{ data: ServiceDemand[] }>(`/demands/opportunities?matching=${onlyMatching}`);
  return r.data ?? [];
}

export async function getDemand(id: string): Promise<{ demand: ServiceDemand; responses: DemandResponse[] }> {
  const r = await apiFetchJson<{ data: { demand: ServiceDemand; responses: DemandResponse[] } }>(`/demands/${id}`);
  return r.data;
}

export async function respondDemand(id: string, input: { quoteCents?: number; message?: string }) {
  const r = await apiFetchJson<{ data: { demand: ServiceDemand; response: DemandResponse } }>(
    `/demands/${id}/respond`, { method: 'POST', body: JSON.stringify(input) });
  return r.data;
}

export async function chooseResponse(demandId: string, responseId: string) {
  const r = await apiFetchJson<{ data: { demand: ServiceDemand; response: DemandResponse } }>(
    `/demands/${demandId}/responses/${responseId}/choose`, { method: 'POST', body: '{}' });
  return r.data;
}

export async function withdrawResponse(demandId: string, responseId: string) {
  const r = await apiFetchJson<{ data: { demand: ServiceDemand; response: DemandResponse } }>(
    `/demands/${demandId}/responses/${responseId}/withdraw`, { method: 'POST', body: '{}' });
  return r.data;
}
