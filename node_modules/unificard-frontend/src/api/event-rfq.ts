// frontend/src/api/event-rfq.ts
// API client para RFQ (Request for Quotation) / ORÇAMENTO EM LOTE

import { apiFetch } from './client';

/**
 * Status do RFQ
 */
export type RFQStatus = 'open' | 'closed';

/**
 * Item do RFQ
 */
export interface RFQItem {
  type: 'need' | 'service';
  id: string;
  category?: string;
  description?: string | null;
}

/**
 * Critérios do RFQ
 */
export interface RFQCriteria {
  expectedPriceCents?: number | null;
  date?: string | null;
  location?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  notes?: string | null;
}

/**
 * Event RFQ
 */
export interface EventRFQ {
  rfqId: string;
  eventId: string;
  tenantId: string;
  organizerActorId: string;
  items: RFQItem[];
  criteria: RFQCriteria;
  status: RFQStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  closedAt?: string | null; // ISO 8601
}

/**
 * Input para criar RFQ
 */
export interface CreateEventRFQInput {
  items: RFQItem[];
  criteria: RFQCriteria;
}

/**
 * Resultado da criação de RFQ
 */
export interface CreateEventRFQResult {
  rfq: EventRFQ;
  servicesNotified: number;
}

/**
 * Resposta de orçamento (Quote)
 */
export interface QuoteResponse {
  quoteId: string;
  rfqId: string;
  serviceId: string;
  providerActorId: string;
  priceCents: number;
  currency: string;
  notes?: string | null;
  validityDays?: number | null;
  validUntil?: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Input para responder RFQ
 */
export interface CreateQuoteResponseInput {
  serviceId: string;
  priceCents: number;
  currency: string;
  notes?: string | null;
  validityDays?: number | null;
}

/**
 * Cria novo RFQ para um evento
 */
export async function createEventRFQ(
  eventId: string,
  input: CreateEventRFQInput
): Promise<CreateEventRFQResult> {
  const response = await apiFetch(`/events/${eventId}/rfqs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar RFQ' }));
    throw new Error(error.error || 'Erro ao criar RFQ');
  }

  return response.json();
}

/**
 * Lista RFQs de um evento
 */
export async function getEventRFQs(eventId: string): Promise<{ rfqs: EventRFQ[]; total: number }> {
  const response = await apiFetch(`/events/${eventId}/rfqs`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar RFQs' }));
    throw new Error(error.error || 'Erro ao buscar RFQs');
  }

  return response.json();
}

/**
 * Busca RFQ por ID
 */
export async function getRFQById(eventId: string, rfqId: string): Promise<EventRFQ> {
  const response = await apiFetch(`/events/${eventId}/rfqs/${rfqId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar RFQ' }));
    throw new Error(error.error || 'Erro ao buscar RFQ');
  }

  const data = await response.json();
  return data.rfq;
}

/**
 * Fecha RFQ
 */
export async function closeRFQ(eventId: string, rfqId: string): Promise<EventRFQ> {
  const response = await apiFetch(`/events/${eventId}/rfqs/${rfqId}/close`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao fechar RFQ' }));
    throw new Error(error.error || 'Erro ao fechar RFQ');
  }

  const data = await response.json();
  return data.rfq;
}

/**
 * Cria proposta (Quote) para um RFQ
 */
export async function createQuote(
  eventId: string,
  rfqId: string,
  input: CreateQuoteResponseInput
): Promise<QuoteResponse> {
  const response = await apiFetch(`/events/${eventId}/rfqs/${rfqId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar proposta' }));
    throw new Error(error.error || 'Erro ao criar proposta');
  }

  const data = await response.json();
  return data.quote;
}

/**
 * Lista propostas de um RFQ
 */
export async function getRFQQuotes(
  eventId: string,
  rfqId: string
): Promise<{ quotes: QuoteResponse[]; total: number }> {
  const response = await apiFetch(`/events/${eventId}/rfqs/${rfqId}/quotes`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar propostas' }));
    throw new Error(error.error || 'Erro ao buscar propostas');
  }

  return response.json();
}

/**
 * Cria RFQ a partir de EventSpec
 */
export async function createRFQFromSpec(
  eventId: string,
  specId: string
): Promise<CreateEventRFQResult> {
  const response = await apiFetch(`/events/${eventId}/rfqs/from-spec/${specId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar RFQ a partir de EventSpec' }));
    throw new Error(error.error || 'Erro ao criar RFQ a partir de EventSpec');
  }

  return response.json();
}

/**
 * Empresa compatível com RFQ
 */
export interface CompatibleCompany {
  actorId: string;
  name: string;
  category?: string;
  services?: string[];
  location?: string;
}

/**
 * Busca empresas compatíveis para um RFQ
 */
export async function getCompatibleCompanies(
  eventId: string,
  rfqId: string
): Promise<{ companies: CompatibleCompany[]; note?: string }> {
  const response = await apiFetch(`/events/${eventId}/rfqs/${rfqId}/compatible-companies`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar empresas compatíveis' }));
    throw new Error(error.error || 'Erro ao buscar empresas compatíveis');
  }

  return response.json();
}

/**
 * Dispara RFQ para empresas selecionadas
 */
export async function dispatchRFQ(
  eventId: string,
  rfqId: string,
  companyActorIds: string[]
): Promise<{ dispatched: number; companies: CompatibleCompany[] }> {
  const response = await apiFetch(`/events/${eventId}/rfqs/${rfqId}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ companyActorIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao disparar RFQ' }));
    throw new Error(error.error || 'Erro ao disparar RFQ');
  }

  return response.json();
}




