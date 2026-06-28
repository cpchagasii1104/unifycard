// frontend/src/api/offerings.ts
// B2 / F-OFFER-B2-FRONTEND-SERVICE-OFFERING-WIRING
// Wrapper do contrato canônico de service_offering (consome backend já provado em B1; pré-dinheiro).
// Disciplina: frontend PROJETA verdade resolvida — não cria/deriva identidade. canonicalServiceId vem do DTO
// de discovery (transportado). by-canonical retorna SÓ offerings ACTIVE (draft nunca vaza — gate no backend).

import { apiFetchJson } from './client';

export interface ServiceOffering {
  id: string;
  tenantId: string;
  canonicalServiceId: string;
  serviceId?: string | null;
  providerActorId: string;
  companyId?: string | null;
  professionalActorId?: string | null;
  priceCents: number;
  durationMinutes: number;
  modality?: string | null;
  status: 'draft' | 'active' | 'suspended';
}

/**
 * Lista as ofertas ATIVAS de um service canônico (discovery → seleção de oferta contratável).
 * GET /services/offerings/by-canonical/:canonicalServiceId → { ok, data: ServiceOffering[] } (active-only no backend).
 */
export async function getOfferingsByCanonical(canonicalServiceId: string): Promise<ServiceOffering[]> {
  const res = await apiFetchJson<{ ok: boolean; data: ServiceOffering[] }>(
    `/services/offerings/by-canonical/${canonicalServiceId}`
  );
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

/**
 * Cria uma oferta contratável para um service canônico (provider = actor ativo representando a empresa).
 * POST /services/offerings → { ok, data: ServiceOffering, created }. Nasce DRAFT (criação ≠ ativação).
 * O backend resolve o service_id soberano (actor+canonical) e exige req.user representar providerActorId.
 */
export async function createOffering(input: {
  providerActorId: string;
  canonicalServiceId: string;
  priceCents: number;
  durationMinutes: number;
  companyId?: string | null;
  professionalActorId?: string | null;
  modality?: 'in_person' | 'remote' | 'home';
}): Promise<ServiceOffering> {
  const res = await apiFetchJson<{ ok: boolean; data: ServiceOffering; created?: boolean }>(
    '/services/offerings',
    { method: 'POST', body: JSON.stringify(input) }
  );
  if (!res?.ok || !res.data) throw new Error('Erro ao criar oferta');
  return res.data;
}

/**
 * Ativa a oferta (DRAFT → ACTIVE) — GATE de elegibilidade PJ é avaliado no backend (DECISION canônica).
 * PUT /services/offerings/:offeringId { status:'active' } → { ok }.
 */
export async function activateOffering(offeringId: string): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'active' }),
  });
  if (!res?.ok) throw new Error('Erro ao ativar oferta');
}

/**
 * Atualiza campos editáveis da oferta JÁ publicada (preço/duração/status) — pós-publicação.
 * Usa o PUT já existente no backend (service-offerings.routes.ts → updateSchema
 * { priceCents?, durationMinutes?, status? }); autoridade server-side = canRepresentActor(provider).
 * priceCents é SEMPRE centavo inteiro (nunca float como verdade). PUT /services/offerings/:offeringId → { ok }.
 * (activateOffering acima é o caso particular status:'active'; este wrapper é o genérico de edição.)
 */
export async function updateOffering(
  offeringId: string,
  input: { priceCents?: number; durationMinutes?: number; status?: 'draft' | 'active' | 'suspended' }
): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!res?.ok) throw new Error('Erro ao atualizar oferta');
}

/**
 * Declara uma janela de disponibilidade física da oferta (owner=service_offering — SSOT temporal).
 * POST /services/offerings/:offeringId/availability { startDatetime, endDatetime, capacity? } → { ok, data }.
 */
export async function declareOfferingAvailability(
  offeringId: string,
  input: { startDatetime: string; endDatetime: string; capacity?: number }
): Promise<{ availabilityId?: string } & Record<string, any>> {
  const res = await apiFetchJson<{ ok: boolean; data: Record<string, any> }>(
    `/services/offerings/${offeringId}/availability`,
    { method: 'POST', body: JSON.stringify(input) }
  );
  if (!res?.ok || !res.data) throw new Error('Erro ao declarar disponibilidade da oferta');
  return res.data;
}

/**
 * true se o erro for o conflito de horário por provider (DECISION-0146 / F-OFFER-5/6, HTTP 409
 * BOOKING_PROVIDER_TIME_CONFLICT). Usado para dar UX honesta específica em vez de erro genérico.
 */
export function isProviderTimeConflict(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code;
  const msg = String(e?.message ?? '');
  return code === 'BOOKING_PROVIDER_TIME_CONFLICT' || /BOOKING_PROVIDER_TIME_CONFLICT/.test(msg);
}
