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
