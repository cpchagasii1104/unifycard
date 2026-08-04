// src/api/events.ts
// API de eventos (read-only e multi-atores)
import { apiFetch, apiFetchJson } from './client';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §7 (frontend espelha a API)
// ║ NÃO:     inventar vocabulário de status paralelo ao CHECK real de `events.status`
// ║ EM VEZ:  os 6 valores abaixo; rótulo/agrupamento por fase vive em EventStatusBadge.tsx
// ╚════════════════════════════════════════════════════════════════
export interface Event {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startTime: string;
  endTime: string;
  // F-EVENT-PUBLISH-FUNNEL: nomes REAIS do payload vivo (event.service.ts toEvent) — `startTime`/
  // `endTime` acima NUNCA são devolvidos por este endpoint (EventPage.tsx lia undefined). NÃO
  // removi os antigos (blast radius de outros consumidores não verificado nesta fatia).
  datetimeStart?: string | null;
  datetimeEnd?: string | null;
  // 🔴 2026-08-04 — TERCEIRO par de nomes para a MESMA data, e o que a LISTA realmente manda.
  // Esta interface é usada por DOIS endpoints com formatos diferentes:
  //   GET /events/:id            (detalhe, event.service.ts toEvent) → datetimeStart/datetimeEnd
  //   GET /api/events/events     (lista/discovery, sprint76)         → startAt/endAt
  // `OrganizerEventsDashboard` lia `datetimeStart` sobre dados da LISTA: sempre `undefined`, então
  // TODOS os eventos (inclusive os 6 publicados COM data) apareciam como "sem data confirmada".
  // Provado com curl na rota real antes de escrever isto. Leia sempre `startAt ?? datetimeStart`.
  startAt?: string | null;
  endAt?: string | null;
  cityId: string | null;
  ticketPrice: number | null;
  acceptsConsumption: boolean;
  acceptsParking: boolean;
  maxCapacity: number | null;
  currentOccupancy: number;
  status: 'draft' | 'declared' | 'published' | 'active' | 'ended' | 'cancelled';
  timezone: string;
  state?: 'PRE' | 'DURING' | 'POST';
  stateInfo?: {
    state: 'PRE' | 'DURING' | 'POST';
    message: string;
    timeUntilStart?: number;
    timeUntilEnd?: number;
    timeSinceEnd?: number;
    isSoon?: boolean;
    isEnding?: boolean;
  };
  metadata?: {
    eventNeeds?: string[];
    selected_services?: string[];
    needsAssistanceEnabled?: boolean;
    categoryId?: string;
    stateId?: string;
    capacity?: unknown;
    venueInfrastructure?: unknown;
  };
}

export interface AvailabilityPreview {
  eventId: string;
  nextAvailableSlots: Array<{
    start: string;
    end: string;
  }>;
  timezone: string;
}

/**
 * Busca evento por ID
 */
export async function getEvent(id: string): Promise<Event> {
  const response = await apiFetch(`/api/events/${id}`);
  return response.json();
}

/**
 * Busca estatísticas de ingressos vendidos (read-only)
 */
export async function getEventStats(eventId: string): Promise<{
  soldCount: number;
  maxCapacity: number | null;
  remaining: number | null;
  occupancyPercent: number | null;
  updatedAt: string;
}> {
  const response = await apiFetch(`/api/events/${eventId}/stats`);
  if (!response.ok) {
    throw new Error('Erro ao buscar estatísticas do evento');
  }
  return response.json();
}

/**
 * Busca economia do evento (read-only)
 */
export async function getEventEconomy(eventId: string): Promise<{
  totalCollected: number;
  expectedTotal: number | null;
  participantsCount: number;
  ticketPriceCents: number | null;
  maxCapacity: number | null;
  lastUpdate: string;
}> {
  const response = await apiFetch(`/api/events/${eventId}/economy`);
  if (!response.ok) {
    throw new Error('Erro ao buscar economia do evento');
  }
  return response.json();
}

/**
 * Busca resumo de fechamento do evento (read-only)
 */
export async function getEventClosureSummary(eventId: string): Promise<{
  participantsCount: number;
  totalCollected: number;
  startedAt: string;
  endedAt: string;
}> {
  const response = await apiFetch(`/api/events/${eventId}/closure-summary`);
  if (!response.ok) {
    throw new Error('Erro ao buscar resumo de fechamento do evento');
  }
  return response.json();
}

/**
 * Busca histórico de transições de estado do evento (read-only)
 */
export async function getEventStateHistory(eventId: string): Promise<Array<{
  state: string;
  changedAt: string;
}>> {
  const response = await apiFetch(`/api/events/${eventId}/state-history`);
  if (!response.ok) {
    throw new Error('Erro ao buscar histórico de estados do evento');
  }
  return response.json();
}

// ===========================
// EVENTOS MULTI-ATORES
// ===========================

export type EventActorRole = 'artist' | 'venue' | 'organizer' | 'sponsor' | 'supporter';
export type EventActorStatus = 'pending' | 'accepted' | 'rejected' | 'removed';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'finished';

export interface EventActor {
  id: string;
  tenantId: string;
  eventId: string;
  actorId: string;
  role: EventActorRole;
  canPublish: boolean;
  canEdit: boolean;
  revenueSharePercent: number | null;
  status: EventActorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MultiActorEvent {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  datetimeStart: string;
  datetimeEnd: string;
  locationName: string | null;
  capacity: number | null;
  cityId: string | null;
  stateId: string | null;
  countryId: string | null;
  createdByGlobalUserId: string;
  createdByActorId: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  actors?: EventActor[];
}

export interface CreateMultiActorEventInput {
  title: string;
  description?: string | null;
  datetimeStart: string;
  datetimeEnd: string;
  locationName?: string | null;
  capacity?: number | null;
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
  actorId: string;
  group_id?: string; // ID do grupo para vincular o evento
}

export interface AddActorToEventInput {
  actorId: string;
  role: EventActorRole;
  canPublish?: boolean;
  canEdit?: boolean;
  revenueSharePercent?: number | null;
}

/**
 * Cria um novo evento como DRAFT
 */
export async function createMultiActorEvent(
  input: CreateMultiActorEventInput
): Promise<MultiActorEvent> {
  return apiFetchJson<MultiActorEvent>('/api/events/multi-actor/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Adiciona um actor a um evento
 */
export async function addActorToEvent(
  eventId: string,
  input: AddActorToEventInput
): Promise<EventActor> {
  return apiFetchJson<EventActor>(`/api/events/multi-actor/${eventId}/add-actor`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Aceita participação de um actor no evento
 */
export async function acceptEventParticipation(
  eventId: string,
  eventActorId: string
): Promise<EventActor> {
  return apiFetchJson<EventActor>(`/api/events/multi-actor/${eventId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ eventActorId }),
  });
}

/**
 * Publica um evento (verifica requisitos mínimos)
 */
export async function publishMultiActorEvent(eventId: string): Promise<MultiActorEvent> {
  return apiFetchJson<MultiActorEvent>(`/api/events/multi-actor/${eventId}/publish`, {
    method: 'POST',
  });
}

/**
 * Busca evento com seus actors
 */
export async function getMultiActorEvent(eventId: string): Promise<MultiActorEvent> {
  return apiFetchJson<MultiActorEvent>(`/api/events/multi-actor/${eventId}`);
}

/**
 * Busca eventos de um actor específico
 */
export async function getEventsByActor(
  actorId: string,
  options?: {
    status?: EventStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ events: MultiActorEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const query = params.toString();
  return apiFetchJson<{ events: MultiActorEvent[]; total: number }>(
    `/api/events/multi-actor/actor/${actorId}${query ? `?${query}` : ''}`
  );
}

/**
 * Preview de disponibilidade (READ-ONLY)
 * 🔴 NUNCA reserva, apenas exibe
 */
export async function getEventAvailabilityPreview(id: string): Promise<AvailabilityPreview> {
  const response = await apiFetch(`/api/feed/events/${id}/availability-preview`);
  return response.json();
}

/**
 * Busca posts relacionados ao evento
 */
export async function getEventPosts(eventId: string, limit: number = 20): Promise<{
  posts: Array<{
    postId: string;
    content: string;
    type: string;
    createdAt: string;
    globalUserId: string;
    media: any[];
    metadata: Record<string, any>;
  }>;
  total: number;
}> {
  const response = await apiFetch(`/api/events/${eventId}/posts?limit=${limit}`);
  return response.json();
}

/**
 * Busca participantes do evento
 */
export async function getEventParticipants(eventId: string, limit: number = 50): Promise<{
  participants: Array<{
    globalUserId: string;
    checkInTime: string | null;
    joinedAt: string;
  }>;
  total: number;
}> {
  const response = await apiFetch(`/api/events/${eventId}/participants?limit=${limit}`);
  return response.json();
}

/**
 * Registra métrica de evento
 */
export async function trackEventMetric(
  eventId: string,
  metricType: 'VIEW' | 'CTA_CLICK' | 'CONVERSION' | 'ABANDONMENT',
  options?: {
    ctaType?: 'ticket' | 'consumption' | 'parking';
    source?: 'feed' | 'event_page' | 'direct';
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await apiFetch(`/api/events/${eventId}/metrics`, {
      method: 'POST',
      body: JSON.stringify({
        metricType,
        ctaType: options?.ctaType,
        source: options?.source,
        metadata: options?.metadata,
      }),
    });
  } catch (error) {
    // Não bloqueia UX se métricas falharem
    console.warn('Erro ao registrar métrica:', error);
  }
}

/**
 * Busca resumo de métricas de um evento
 */
export async function getEventMetrics(eventId: string): Promise<{
  eventId: string;
  totalViews: number;
  totalCTAClicks: number;
  totalConversions: number;
  totalAbandonments: number;
  conversionRate: number;
  ctaClickRate: number;
  byCTAType: {
    ticket?: { clicks: number; conversions: number };
    consumption?: { clicks: number; conversions: number };
    parking?: { clicks: number; conversions: number };
  };
  bySource: {
    feed?: number;
    event_page?: number;
    direct?: number;
  };
}> {
  const response = await apiFetch(`/api/events/${eventId}/metrics`);
  return response.json();
}

/**
 * Busca dashboard completo de métricas de um evento
 */
export async function getEventDashboard(eventId: string): Promise<{
  eventId: string;
  eventTitle: string;
  eventState: 'PRE' | 'DURING' | 'POST';
  metrics: {
    totalViews: number;
    totalCTAClicks: number;
    totalConversions: number;
    totalAbandonments: number;
    conversionRate: number;
    ctaClickRate: number;
  };
  byState: {
    PRE?: { views: number; clicks: number; conversions: number };
    DURING?: { views: number; clicks: number; conversions: number };
    POST?: { views: number; clicks: number; conversions: number };
  };
  byCTAType: {
    ticket?: { clicks: number; conversions: number };
    consumption?: { clicks: number; conversions: number };
    parking?: { clicks: number; conversions: number };
  };
  bySource: {
    feed?: number;
    event_page?: number;
    direct?: number;
  };
  funnel: {
    views: number;
    ctaClicks: number;
    conversions: number;
    dropOffViewsToClicks: number;
    dropOffClicksToConversion: number;
  };
}> {
  const response = await apiFetch(`/api/events/${eventId}/dashboard`);
  return response.json();
}

/**
 * Busca métricas do evento para organizador (versão simplificada)
 */
export async function getOrganizerEventMetrics(eventId: string): Promise<{
  eventId: string;
  eventTitle: string;
  eventState: 'PRE' | 'DURING' | 'POST';
  reach: {
    totalViews: number;
    viewsFromFeed: number;
    viewsFromPage: number;
    viewsDirect: number;
  };
  engagement: {
    totalCTAClicks: number;
    ctaClickRate: number;
  };
  conversion: {
    totalConversions: number;
    conversionRate: number;
  };
  performance: {
    bestCTAType?: 'ticket' | 'consumption' | 'parking';
    bestState?: 'PRE' | 'DURING' | 'POST';
    improvementTip?: string;
  };
}> {
  const response = await apiFetch(`/api/events/${eventId}/organizer-metrics`);
  if (!response.ok) {
    throw new Error('Erro ao carregar métricas do organizador');
  }
  return response.json();
}

/**
 * Organizer Plans & Billing
 */
export interface OrganizerSubscription {
  id: string;
  organizerId: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  paymentGateway?: string;
  canceledAt?: string | null;
}

/**
 * Lista planos disponíveis
 */
export async function getOrganizerPlans(): Promise<{ plans: any[] }> {
  const response = await apiFetch('/api/events/organizers/plans');
  return response.json();
}

/**
 * Busca plano atual do organizador
 */
export async function getOrganizerPlan(organizerId: string): Promise<{
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  planInfo: any;
  expiresAt: string | null;
  isExpired: boolean;
}> {
  const response = await apiFetch(`/api/events/organizers/${organizerId}/plan`);
  return response.json();
}

/**
 * Cria assinatura para organizador
 */
export async function createOrganizerSubscription(
  organizerId: string,
  plan: 'free' | 'basic' | 'pro' | 'enterprise',
  paymentGateway?: string,
  paymentGatewayCustomerId?: string,
  paymentGatewaySubscriptionId?: string
): Promise<OrganizerSubscription> {
  const response = await apiFetch(`/api/events/organizers/${organizerId}/subscribe`, {
    method: 'POST',
    body: JSON.stringify({
      plan,
      paymentGateway,
      paymentGatewayCustomerId,
      paymentGatewaySubscriptionId,
    }),
  });
  return response.json();
}

/**
 * Busca assinatura ativa
 */
export async function getOrganizerSubscription(organizerId: string): Promise<OrganizerSubscription | null> {
  try {
    const response = await apiFetch(`/api/events/organizers/${organizerId}/subscription`);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Cancela assinatura
 */
export async function cancelOrganizerSubscription(
  organizerId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<void> {
  await apiFetch(`/api/events/organizers/${organizerId}/subscription/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancelAtPeriodEnd }),
  });
}

// ===========================
// WIZARD DE CRIAÇÃO (CONTRATO v1)
// ===========================

export interface CreateEventInput {
  actor_id: string;
  actor_type: 'user' | 'page';
  event_type: 'cultural' | 'gastronomic' | 'social' | 'professional' | 'community' | 'spiritual' | 'sports' | 'private';
  event_subtype?: string | null;
  title: string;
  description?: string | null;
  datetime_start: string; // ISO 8601
  datetime_end: string; // ISO 8601
  visibility?: 'public' | 'connections' | 'only_me';
  ticket_price_cents?: number | null;
  max_attendees?: number | null;
  metadata?: Record<string, any> | null;
}

export interface EventResponse {
  event: {
    id: string;
    tenant_id: string;
    actor_id: string;
    actor_type: 'user' | 'page';
    event_type: string;
    event_subtype: string | null;
    title: string;
    description: string | null;
    datetime_start: string;
    datetime_end: string;
    status: 'draft' | 'published' | 'cancelled' | 'completed' | 'archived';
    visibility: string;
    ticket_price_cents: number | null;
    max_attendees: number | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, any> | null;
  };
}

/**
 * Cria um novo evento (draft)
 * CONTRATO: POST /api/events/create (endpoint canônico)
 * Converte CreateEventInput para o formato canônico
 */
export async function createEvent(input: CreateEventInput): Promise<EventResponse> {
  // Converter CreateEventInput para CreateEventInputCanonical
  const canonicalInput: CreateEventInputCanonical = {
    title: input.title,
    description: input.description || null,
    startTime: input.datetime_start,
    endTime: input.datetime_end,
    // Campos extras do wizard são ignorados (endpoint canônico não suporta)
    // actor_id, event_type, etc. são armazenados em metadata se necessário
  };

  const response = await createEventCanonical(canonicalInput);
  
  // Converter resposta canônica para EventResponse esperado pelo wizard
  // O endpoint canônico retorna { event: { id, tenantId, title, startTime, endTime, ... }, aiSuggestions }
  const event = response.event || response;
  
  // Converter Date para ISO string se necessário
  const startTimeStr = typeof event.startTime === 'string' 
    ? event.startTime 
    : (event.startTime instanceof Date ? event.startTime.toISOString() : input.datetime_start);
  const endTimeStr = typeof event.endTime === 'string'
    ? event.endTime
    : (event.endTime instanceof Date ? event.endTime.toISOString() : input.datetime_end);
  
  return {
    event: {
      id: event.id || '',
      tenant_id: event.tenantId || '',
      actor_id: input.actor_id,
      actor_type: input.actor_type,
      event_type: input.event_type,
      event_subtype: input.event_subtype || null,
      title: event.title || input.title,
      description: event.description || input.description || null,
      datetime_start: startTimeStr,
      datetime_end: endTimeStr,
      status: 'draft' as const,
      visibility: input.visibility || 'public',
      ticket_price_cents: input.ticket_price_cents || null,
      max_attendees: input.max_attendees || null,
      completed_at: null,
      created_at: typeof event.createdAt === 'string' 
        ? event.createdAt 
        : (event.createdAt instanceof Date ? event.createdAt.toISOString() : new Date().toISOString()),
      updated_at: typeof event.updatedAt === 'string'
        ? event.updatedAt
        : (event.updatedAt instanceof Date ? event.updatedAt.toISOString() : new Date().toISOString()),
      metadata: input.metadata || null,
    },
  };
}

/**
 * Cria um novo evento usando o endpoint canônico
 * CONTRATO: POST /api/events/create
 */
export interface CreateEventInputCanonical {
  title: string;
  description?: string | null;
  startTime: string; // ISO 8601 datetime string
  endTime: string; // ISO 8601 datetime string
  cityId?: string | null;
  stateId?: string | null;
  countryId?: string | null;
  group_id?: string; // ID do grupo para vincular o evento
}

export async function createEventCanonical(input: CreateEventInputCanonical): Promise<any> {
  return apiFetchJson<any>('/api/events/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Publica um evento (draft → published)
 * CONTRATO v1: POST /events/:id/publish
 */
export async function publishEvent(eventId: string): Promise<EventResponse> {
  return apiFetchJson<EventResponse>(`/api/events/${eventId}/publish`, {
    method: 'POST',
  });
}

/**
 * Busca um evento por ID
 * CONTRATO v1: GET /events/:id
 */
export async function getEventById(eventId: string): Promise<EventResponse> {
  return apiFetchJson<EventResponse>(`/api/events/${eventId}`);
}

/**
 * Atualiza um evento
 * CONTRATO v1: PATCH /events/:id
 */
export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  datetime_start?: string;
  datetime_end?: string;
  event_subtype?: string | null;
  visibility?: 'public' | 'connections' | 'only_me';
  ticket_price_cents?: number | null;
  max_attendees?: number | null;
  // Acesso/custo (anúncio, Δbank=0) + capacidade mínima — vocabulário GOVERNADO pt-BR.
  event_access_type?: 'gratuito' | 'pago' | 'contribuicao_opcional' | null;
  min_attendees?: number | null;
  // F-EVENT-CONCEPT-FIRST-MODEL: identidade = formato (concept) + temas (concepts) + facets; location governado.
  event_format_concept_id?: string | null;
  location_mode?: 'fixed_place' | 'online' | 'hybrid' | 'to_be_defined' | 'route' | null;
  theme_concept_ids?: string[];
  category_facets?: string[];
  // Fase A orquestração: LOCAL via Location Core (cityId SSOT, nunca texto).
  venue_city_id?: string | null;
  venue_neighborhood_id?: string | null;
  venue_neighborhood_display?: string | null;
  venue_postal_code?: string | null;
  // SLICE S2 (VENUE ENRICHMENT): logradouro do local reusa addresses.street/number/complement;
  // Nome do Local = chave canônica events.metadata.location_name (o backend faz o merge JSONB).
  venue_street?: string | null;
  venue_number?: string | null;
  venue_complement?: string | null;
  location_name?: string | null;
  // SLICE S1 (VAQUINHA all-or-nothing): regras DECLARADAS, Δbank=0 — META = min_attendees (pessoas).
  // funding_deadline_at = PRAZO da vaquinha (≠ datetime_end). Regras espelhadas no backend (400 VAQUINHA_*).
  funding_deadline_at?: string | null;
  is_all_or_nothing?: boolean;
  metadata?: Record<string, any> | null;
}

export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<EventResponse> {
  // Rotas de evento montadas em /api/events (app.builder). Sem o /api, cai em 404 (bug: path v1 legado).
  return apiFetchJson<EventResponse>(`/api/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// 🔴 FATIA 3B — leitura do ELENCO (event_staff) pela rota v2 selada do event-core.
// GET /api/events/:id/v2/commitments → { commitments: [...] } (sem wrapper ok; event.routes.ts:1981).
// Read-only: prova o BIND on-confirm do performer (C3 EDGE C-2, role 'artist').
export interface EventCommitmentView {
  id: string;
  eventId: string;
  responsibleActorId: string;
  responsibleActorType: 'user' | 'page' | 'group' | 'channel';
  role: string;
  status: string;
  timeWindowRef?: Record<string, any> | null;
  createdAt: string;
}

export async function listEventCommitmentsV2(eventId: string): Promise<EventCommitmentView[]> {
  const res = await apiFetchJson<{ commitments: EventCommitmentView[] }>(`/api/events/${eventId}/v2/commitments`);
  return Array.isArray(res?.commitments) ? res.commitments : [];
}

// F-EVENT-CONCEPT-FIRST-MODEL — taxonomia SERVER-DRIVEN (o front NUNCA enumera formato/categoria).
export interface EventFormatOption {
  key: string; conceptId: string; label: string;
  supportsCapacity: boolean; supportsTicketPrice: boolean;
  supportsRouteLocation: boolean; supportsOrchestration: boolean;
  requiredCapabilities: string[] | null;
}
export interface EventTaxonomy {
  formats: EventFormatOption[];
  categories: Array<{ key: string; label: string }>;
  locationModes: Array<{ key: string; label: string; enabled: boolean; reasonDisabled: string | null }>;
  accessTypes: Array<{ key: string; label: string }>;
}
export async function getEventTaxonomy(): Promise<EventTaxonomy> {
  const res = await apiFetchJson<{ ok: boolean; data: EventTaxonomy }>(`/api/events/taxonomy`);
  return res.data;
}
export async function searchEventThemes(q: string): Promise<Array<{ key: string; conceptId: string; label: string }>> {
  if (q.trim().length < 2) return [];
  const res = await apiFetchJson<{ ok: boolean; data: { themes: Array<{ key: string; conceptId: string; label: string }> } }>(`/api/events/themes/search?q=${encodeURIComponent(q)}`);
  return res.data.themes;
}



// DECISION-0161 (fatia 3): plateia actor-adaptativa — o wizard PROJETA o contrato server-driven.
export interface EventAudienceOption {
  key: string;
  label: string;
  visibility: 'public' | 'connections' | 'only_me';
  audienceRelationshipTypes: string[] | null;
}

export async function getEventAudienceOptions(): Promise<{ actorType: string; options: EventAudienceOption[] }> {
  const response = await apiFetch(`/api/events/audience-options`);
  const body = await response.json();
  return body.data;
}

/** Writer 0161: aplica plateia (macro+refinamento) ao evento — organizer-only no backend. */
export async function patchEventAudience(
  eventId: string,
  visibility: string,
  audienceRelationshipTypes: string[] | null
): Promise<void> {
  await apiFetch(`/api/events/${eventId}/audience`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visibility, audienceRelationshipTypes }),
  });
}

// F-EVENT-ORCHESTRATION-PHASE-B-WRITE — sugestões governadas + seleção do organizador (event_operational_needs).
export interface OrchestrationSuggestion { needConceptId: string; label: string; fulfillmentKind: string; isRequired: boolean; sortOrder: number; }
export interface OperationalNeed { needConceptId: string; label: string; status: string; }

export async function getOrchestrationSuggestions(eventId: string): Promise<OrchestrationSuggestion[]> {
  const res = await apiFetchJson<{ suggestions: OrchestrationSuggestion[] }>(`/api/events/${eventId}/orchestration-suggestions`);
  return res.suggestions ?? [];
}
export async function getOperationalNeeds(eventId: string): Promise<OperationalNeed[]> {
  const res = await apiFetchJson<{ needs: OperationalNeed[] }>(`/api/events/${eventId}/operational-needs`);
  return res.needs ?? [];
}
export async function addOperationalNeed(eventId: string, needConceptId: string): Promise<void> {
  await apiFetchJson(`/api/events/${eventId}/operational-needs`, { method: 'POST', body: JSON.stringify({ needConceptId }) });
}
export async function removeOperationalNeed(eventId: string, needConceptId: string): Promise<void> {
  await apiFetchJson(`/api/events/${eventId}/operational-needs/${encodeURIComponent(needConceptId)}`, { method: 'DELETE' });
}

// ===========================
// SETORES (SLICE S3) — setor self-contained com inteira/meia (piso legal 40% — Lei 12.933/2013)
// ===========================
// Rotas sprint76 (events-sprint76.routes.ts) declaram path '/events/:id/sectors' e o módulo é registrado
// com prefix '/api/events' (app.builder) → URL real /api/events/events/:id/sectors.
// Body keys EXATAS do backend (CreateEventSectorInput, event-sector.repository.ts): sectorNumber, name,
// capacity, meiaQuotaBps (4000..10000; default legal 4000), inteiraPriceCents, meiaPriceCents.
// Regras espelhadas no backend: meia = METADE EXATA da inteira (SECTOR_MEIA_PRICE_NOT_HALF — Lei
// 12.933/2013, não só "mais barata"), cota 40%–100% (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR),
// SUM(capacity) ≤ max_attendees (SECTOR_CAPACITY_EXCEEDS_EVENT, reconciliado atomicamente).

export interface EventSector {
  id: string;
  tenantId: string;
  eventId: string;
  sectorNumber: number;
  name: string;
  capacity: number;
  meiaQuotaBps: number;
  inteiraPriceCents: number;
  meiaPriceCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventSectorInput {
  sectorNumber: number;
  name: string;
  capacity: number;
  meiaQuotaBps?: number; // default DB = 4000 (piso legal 40%)
  inteiraPriceCents: number;
  meiaPriceCents: number;
}

/** Lista os setores do evento (GET canViewEvent-gated; 404 não-leak para quem não pode ver). */
export async function listEventSectors(eventId: string): Promise<EventSector[]> {
  return apiFetchJson<EventSector[]>(`/api/events/events/${eventId}/sectors`);
}

/** Cria setor (POST owner-gated: chave exata create_events sobre o dono do evento). */
/**
 * Eventos DO ORGANIZADOR, para a tela de gestão (F-EVENT-ORGANIZER-DASHBOARD).
 * 🔴 O modo de visibilidade é decidido pelo SERVIDOR (events-sprint76.routes.ts): com
 * organizerActorId e caller que pode representá-lo, ele abre `organizer_dashboard` e devolve também
 * os NÃO-públicos (draft/declared). Sem representação, cai para vitrine pública daquele organizador.
 * O frontend só ESTREITA; o piso é do backend — não passamos status para "forçar" ver rascunho.
 */
export async function listOrganizerEvents(organizerActorId: string): Promise<Event[]> {
  const res = await apiFetchJson<{ events: Event[]; total: number }>(
    `/api/events/events?organizerActorId=${encodeURIComponent(organizerActorId)}&limit=200`
  );
  return res.events ?? [];
}

/**
 * VITRINE pública de eventos (modo Consumir de /eventos).
 *
 * 🔴 2026-08-04 — substitui `getUnifiedFeed()`, que batia em `/api/feed`, endpoint **APOSENTADO**:
 *   {"error":"Legacy feed endpoint retired. Use the canonical GET /social/feed (social 2.0)."}
 * `EventosPage` engolia esse erro num `.catch(() => ({items:[]}))` e culpava uma dívida de schema
 * no comentário — então a vitrine mostrava "Nenhum evento encontrado" SEMPRE, por endpoint morto e
 * não por falta de evento. Medido com curl contra a rota real antes de trocar.
 *
 * A rota canônica é a MESMA de `listOrganizerEvents`, sem `organizerActorId`: o servidor então
 * aplica o piso `public_discovery` (visibility='public' AND status IN ('published','active')) —
 * events-sprint76.routes.ts:208-216. Quem decide o que é público é o BACKEND; aqui não se filtra
 * status, senão o frontend viraria a autoridade do que aparece.
 */
/**
 * Filtros da vitrine. 🔴 O VOCABULÁRIO deles é GOVERNADO e vem de `getEventTaxonomy()` — o
 * frontend nunca enumera formato nem categoria. Valor fora do vocabulário → o backend devolve
 * 400 nomeado (EVENT_FORMAT_UNKNOWN / EVENT_CATEGORY_UNKNOWN), nunca ignora em silêncio: filtro
 * ignorado calado faria o usuário pedir "só shows", receber tudo, e achar que viu tudo o que há.
 */
export interface PublicEventFilters {
  formatSlug?: string;
  categoryKey?: string;
  themeConceptId?: string;
  onlyFree?: boolean;
  maxPriceCents?: number;
  startAtFrom?: string;
  startAtTo?: string;
}

export async function listPublicEvents(limit = 50, filtros: PublicEventFilters = {}): Promise<Event[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (filtros.formatSlug) qs.set('formatSlug', filtros.formatSlug);
  if (filtros.categoryKey) qs.set('categoryKey', filtros.categoryKey);
  if (filtros.themeConceptId) qs.set('themeConceptId', filtros.themeConceptId);
  if (filtros.onlyFree) qs.set('onlyFree', 'true');
  else if (typeof filtros.maxPriceCents === 'number') qs.set('maxPriceCents', String(Math.trunc(filtros.maxPriceCents)));
  if (filtros.startAtFrom) qs.set('startAtFrom', filtros.startAtFrom);
  if (filtros.startAtTo) qs.set('startAtTo', filtros.startAtTo);
  const res = await apiFetchJson<{ events: Event[]; total: number }>(`/api/events/events?${qs.toString()}`);
  return res.events ?? [];
}

/** Um fornecedor candidato para uma necessidade do evento (projeção de GET /events/:id/need-suppliers). */
export interface NeedSupplier {
  sourceKind: 'service' | 'rentable';
  offerId: string;
  providerActorId: string;
  providerDisplayName: string | null;
  offerLabel: string | null;
  priceCents: number | null;
  priceUnit: string | null;
}

export interface NeedWithSuppliers {
  needConceptId: string;
  label: string;
  fulfillmentKind: string;
  isRequired: boolean;
  declaredStatus: string | null;
  supplierCount: number;
  suppliers: NeedSupplier[];
}

/**
 * F-EVENT-SUPPLIER-BRIDGE — necessidades do evento JÁ resolvidas contra fornecedores reais.
 * A junção (need_concept → oferta de serviço / recurso locável) é feita no BACKEND, por CONCEPT.
 * O frontend NÃO cruza id nenhum: só desenha o que vier ("a verdade vive no backend", Clayton).
 */
export async function getEventNeedSuppliers(eventId: string, onlyDeclared = false): Promise<NeedWithSuppliers[]> {
  // Prefixo `/api/events/` — o mesmo das rotas irmãs (`orchestration-suggestions`,
  // `operational-needs`). Conferido no arquivo antes de escrever: errar o prefixo aqui produziria
  // 404 silencioso, exatamente o defeito que esta fatia está consertando na vitrine.
  const res = await apiFetchJson<{ needs: NeedWithSuppliers[] }>(
    `/api/events/${encodeURIComponent(eventId)}/need-suppliers${onlyDeclared ? '?onlyDeclared=true' : ''}`
  );
  return res.needs ?? [];
}

/**
 * Edita uma área existente. F-EVENT-SECTOR-EDIT: sem isto, área errada era definitiva.
 * O backend revalida TUDO (meia = metade exata, cota >= 40%, SUM <= capacidade sob advisory lock).
 */
export async function updateEventSector(
  eventId: string,
  sectorId: string,
  input: Partial<CreateEventSectorInput>
): Promise<EventSector> {
  return apiFetchJson<EventSector>(`/api/events/events/${eventId}/sectors/${sectorId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Remove uma área. Apagar só LIBERA capacidade — nunca estoura o teto. */
export async function deleteEventSector(eventId: string, sectorId: string): Promise<void> {
  await apiFetchJson(`/api/events/events/${eventId}/sectors/${sectorId}`, { method: 'DELETE' });
}

export async function createEventSector(
  eventId: string,
  input: CreateEventSectorInput
): Promise<EventSector> {
  return apiFetchJson<EventSector>(`/api/events/events/${eventId}/sectors`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ── F-EVENT-FREE-REGISTRATION (2026-08-04) ─────────────────────────────────────────────────
// Inscrição em evento — o caminho que fecha o ciclo SEM tocar em dinheiro (Δbank=0).
//
// 🔴 Estas rotas existiam e NUNCA funcionaram: liam `request.tenant_id`/`request.user_id`, que os
// plugins não põem no request (é `req.tenant.id`/`req.user.userId`), então devolviam 401 SEMPRE.
// Por isso `event_rsvp` estava com 0 linhas. Corrigido no backend nesta mesma fatia.
//
// Vocabulário governado por CHECK no banco: `pending|yes|no|maybe`. A rota aceita os 3 últimos.

export type RSVPStatus = 'yes' | 'no' | 'maybe';

export interface EventRSVP {
  id: string;
  event_id: string;
  status: RSVPStatus;
  notes: string | null;
}

export interface RSVPCounts { yes: number; no: number; maybe: number }

/** Confirma (ou muda) presença. Idempotente: reclicar devolve o MESMO id, não duplica. */
export async function setEventRSVP(eventId: string, status: RSVPStatus): Promise<EventRSVP> {
  const res = await apiFetchJson<{ rsvp: EventRSVP }>(`/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  return res.rsvp;
}

/**
 * Minha inscrição neste evento — `null` quando não há (o backend devolve 404 para "não inscrito",
 * que é ausência esperada, não erro). Distingue ausência de FALHA: falha propaga.
 */
export async function getMyEventRSVP(eventId: string): Promise<EventRSVP | null> {
  try {
    const res = await apiFetchJson<{ rsvp: EventRSVP }>(`/api/events/${eventId}/rsvp/status`);
    return res.rsvp ?? null;
  } catch (e) {
    const code = (e as { statusCode?: number } | null)?.statusCode;
    if (code === 404) return null;
    throw e;
  }
}

/** Cancela a inscrição. */
export async function removeEventRSVP(eventId: string): Promise<void> {
  await apiFetchJson(`/api/events/${eventId}/rsvp`, { method: 'DELETE' });
}

/** Quantos confirmaram. Fonte: agregação de `event_rsvp` (não há tabela de contagem paralela). */
export async function getEventRSVPCounts(eventId: string): Promise<RSVPCounts> {
  const res = await apiFetchJson<{ counts: RSVPCounts }>(`/api/events/${eventId}/rsvp/counts`);
  return res.counts;
}

/**
 * CATÁLOGO de tipos de fornecedor para evento — DESACOPLADO de evento (F-EVENT-SUPPLIER-CATALOG).
 *
 * 🔴 É o eixo que a tela "Quem me ajuda" precisa. Antes ela usava `getEventNeedSuppliers`
 * (event-first) como menu principal, e por isso o topo listava os EVENTOS do organizador em vez
 * dos TIPOS de fornecedor — o que Clayton apontou três vezes.
 *
 * `eventId` aqui é CONTEXTO, não eixo: o servidor deriva a janela de data do evento (se o caller
 * puder vê-lo), para quem chega por um evento não redigitar a data que o sistema já sabe.
 */
export async function getSupplierCatalog(params: {
  availableFrom?: string;
  availableTo?: string;
  needConceptId?: string;
  eventId?: string;
} = {}): Promise<NeedWithSuppliers[]> {
  const qs = new URLSearchParams();
  if (params.availableFrom) qs.set('availableFrom', params.availableFrom);
  if (params.availableTo) qs.set('availableTo', params.availableTo);
  if (params.needConceptId) qs.set('needConceptId', params.needConceptId);
  if (params.eventId) qs.set('eventId', params.eventId);
  const q = qs.toString();
  const res = await apiFetchJson<{ needs: NeedWithSuppliers[] }>(`/api/events/supplier-catalog${q ? `?${q}` : ''}`);
  return res.needs ?? [];
}
