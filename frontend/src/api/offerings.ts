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
  // 🔴 RAIO-X do performer — política de contratação (F-PERFORMER-CONTRACTING-POLICY) e faixa de público
  // preferida (F-PERFORMER-AUDIENCE-RANGE). Todos vêm do read model (toOffering) do backend selado.
  bookingApprovalMode?: 'manual' | 'automatic' | null;
  acceptDirectSameCity?: boolean | null;
  acceptDirectRadiusKm?: number | null;
  audienceMin?: number | null;
  audienceMax?: number | null;
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
  // RAIO-X: política de contratação + faixa de público (opcionais; backend valida both-or-neither/min<=max).
  bookingApprovalMode?: 'manual' | 'automatic' | null;
  acceptDirectSameCity?: boolean | null;
  acceptDirectRadiusKm?: number | null;
  audienceMin?: number | null;
  audienceMax?: number | null;
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
  input: {
    priceCents?: number;
    durationMinutes?: number;
    status?: 'draft' | 'active' | 'suspended';
    // RAIO-X — política de contratação + faixa de público. Semântica null-vs-ausente preservada pelo backend
    // ('field' in body): AUSENTE = não mexe; null = limpa; valor = define. JSON.stringify omite chaves undefined,
    // então o caller manda SÓ os campos da aba que está editando (nunca reescreve o que não tocou).
    bookingApprovalMode?: 'manual' | 'automatic' | null;
    acceptDirectSameCity?: boolean | null;
    acceptDirectRadiusKm?: number | null;
    audienceMin?: number | null;
    audienceMax?: number | null;
  }
): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!res?.ok) throw new Error('Erro ao atualizar oferta');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 RAIO-X DO PERFORMER — facetas (gênero/equipamento), cardápio de configs (line-up) e grade de preço.
// Exposição THIN dos endpoints SELADOS sob o escopo /services (prefixo idêntico às chamadas acima).
// Autoridade = canRepresentActor(provider), fail-closed NO BACKEND — o frontend só projeta/edita.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// ── Gênero (subject-concept governado; espelho de event_theme_links). GET devolve os concept ids TAGUEADOS.
export async function listOfferingGenres(offeringId: string): Promise<string[]> {
  const res = await apiFetchJson<{ ok: boolean; data: string[] }>(`/services/offerings/${offeringId}/genres`);
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

export async function tagOfferingGenres(offeringId: string, subjectConceptIds: string[]): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/genres`, {
    method: 'POST',
    body: JSON.stringify({ subjectConceptIds }),
  });
  if (!res?.ok) throw new Error('Erro ao adicionar gênero(s).');
}

export async function untagOfferingGenre(offeringId: string, conceptId: string): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/genres/${conceptId}`, {
    method: 'DELETE',
  });
  if (!res?.ok) throw new Error('Erro ao remover gênero.');
}

// ── Equipamento (concept de use-area de palco/evento). GET devolve os concept ids TAGUEADOS.
export async function listOfferingEquipment(offeringId: string): Promise<string[]> {
  const res = await apiFetchJson<{ ok: boolean; data: string[] }>(`/services/offerings/${offeringId}/equipment`);
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

export async function tagOfferingEquipment(offeringId: string, equipmentConceptIds: string[]): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/equipment`, {
    method: 'POST',
    body: JSON.stringify({ equipmentConceptIds }),
  });
  if (!res?.ok) throw new Error('Erro ao adicionar equipamento(s).');
}

export async function untagOfferingEquipment(offeringId: string, conceptId: string): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/equipment/${conceptId}`, {
    method: 'DELETE',
  });
  if (!res?.ok) throw new Error('Erro ao remover equipamento.');
}

// ── Cardápio de CONFIGS (formações/line-up). Read model devolve todas as configs ATIVAS com line-up derivado.
export type OfferingConfigStatus = 'disponivel' | 'sob_consulta';
export type OfferingConfigPeriodOfDay = 'manha' | 'tarde' | 'noite';

export interface OfferingConfigMember {
  memberActorId: string;
  isActiveMember: boolean;
}

export interface OfferingConfig {
  id: string;
  serviceOfferingId: string;
  label: string;
  teamSize: number;
  requiresSetupCrew: boolean;
  status: OfferingConfigStatus;
  members: OfferingConfigMember[];
  lineupComplete: boolean;
  defaultPriceCents: number | null;
}

export async function listOfferingConfigs(offeringId: string): Promise<OfferingConfig[]> {
  const res = await apiFetchJson<{ ok: boolean; data: OfferingConfig[] }>(`/services/offerings/${offeringId}/configs`);
  return res?.ok && Array.isArray(res.data) ? res.data : [];
}

export async function createOfferingConfig(
  offeringId: string,
  input: { label: string; teamSize: number; requiresSetupCrew?: boolean | null; status?: OfferingConfigStatus | null }
): Promise<OfferingConfig> {
  const res = await apiFetchJson<{ ok: boolean; data: OfferingConfig }>(`/services/offerings/${offeringId}/configs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res?.ok || !res.data) throw new Error('Erro ao criar formação.');
  return res.data;
}

export async function updateOfferingConfig(
  offeringId: string,
  configId: string,
  input: {
    label?: string;
    teamSize?: number;
    requiresSetupCrew?: boolean;
    status?: OfferingConfigStatus;
    // null = limpa a base "a partir de" da config (cai na base da oferta); número = define; ausente = não mexe.
    defaultPriceCents?: number | null;
  }
): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/configs/${configId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!res?.ok) throw new Error('Erro ao atualizar formação.');
}

export async function deleteOfferingConfig(offeringId: string, configId: string): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/configs/${configId}`, {
    method: 'DELETE',
  });
  if (!res?.ok) throw new Error('Erro ao remover formação.');
}

export async function addConfigMember(offeringId: string, configId: string, memberActorId: string): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/configs/${configId}/members`, {
    method: 'POST',
    body: JSON.stringify({ memberActorId }),
  });
  if (!res?.ok) throw new Error('Erro ao incluir integrante.');
}

export async function removeConfigMember(offeringId: string, configId: string, memberActorId: string): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(
    `/services/offerings/${offeringId}/configs/${configId}/members/${memberActorId}`,
    { method: 'DELETE' }
  );
  if (!res?.ok) throw new Error('Erro ao remover integrante.');
}

// ── Grade de preço por CONFIG (dia-da-semana 0=Dom..6=Sáb × período do dia). Valor DECLARADO de catálogo.
export interface OfferingConfigPriceCell {
  dayOfWeek: number;
  periodOfDay: OfferingConfigPeriodOfDay;
  priceCents: number;
}

export async function listConfigPrices(
  offeringId: string,
  configId: string
): Promise<{ defaultPriceCents: number | null; cells: OfferingConfigPriceCell[] }> {
  const res = await apiFetchJson<{ ok: boolean; data: { defaultPriceCents: number | null; cells: OfferingConfigPriceCell[] } }>(
    `/services/offerings/${offeringId}/configs/${configId}/prices`
  );
  if (!res?.ok || !res.data) return { defaultPriceCents: null, cells: [] };
  return { defaultPriceCents: res.data.defaultPriceCents ?? null, cells: Array.isArray(res.data.cells) ? res.data.cells : [] };
}

export async function setConfigPrice(
  offeringId: string,
  configId: string,
  input: { dayOfWeek: number; periodOfDay: OfferingConfigPeriodOfDay; priceCents: number }
): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/configs/${configId}/prices`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!res?.ok) throw new Error('Erro ao definir preço.');
}

export async function removeConfigPrice(
  offeringId: string,
  configId: string,
  input: { dayOfWeek: number; periodOfDay: OfferingConfigPeriodOfDay }
): Promise<void> {
  const res = await apiFetchJson<{ ok: boolean }>(`/services/offerings/${offeringId}/configs/${configId}/prices`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  });
  if (!res?.ok) throw new Error('Erro ao remover preço.');
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔴 FATIA 3B — CONTRATAR (C3 orquestrado). O ORGANIZADOR propõe reserva numa janela da oferta,
// opcionalmente amarrada a um evento SEU (eventId → autoridade manage_attendees revalidada
// server-side) e a uma formação (configId → deve pertencer à oferta; metadata SOFT).
// Body keys EXATAS do backend (service-offerings.routes.ts, bookingSchema linhas 52-59):
//   { availabilityId, requesterActorId, eventId?, configId? }
// POST /services/offerings/:offeringId/bookings → 201 { ok, data: { bookingId, status, autoConfirmed,
// gateReason } }. status: 'confirmed' (aceita-direto within-reach) | 'requested' (negocia).
// O modo (aceita-direto/negocia) e o gate de distância são do DONO — decididos server-side.
// ─────────────────────────────────────────────────────────────────────────────────────────────
export interface OfferingBookingResult {
  bookingId: string;
  status: string; // 'confirmed' | 'requested'
  autoConfirmed: boolean;
  gateReason: string; // ex.: 'manual', 'same_city', 'radius_ok(...)', 'radius_exceeded(...)', 'location_absent'
}

export async function requestOfferingBooking(
  offeringId: string,
  input: { availabilityId: string; requesterActorId: string; eventId?: string; configId?: string }
): Promise<OfferingBookingResult> {
  const res = await apiFetchJson<{ ok: boolean; data: OfferingBookingResult }>(
    `/services/offerings/${offeringId}/bookings`,
    { method: 'POST', body: JSON.stringify(input) }
  );
  if (!res?.ok || !res.data?.bookingId) throw new Error('Erro ao enviar a proposta de contratação.');
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
