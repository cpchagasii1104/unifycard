// src/api/events.ts
// API de eventos (read-only e multi-atores)
import { apiFetch, apiFetchJson } from './client';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startTime: string;
  endTime: string;
  cityId: string | null;
  ticketPrice: number | null;
  acceptsConsumption: boolean;
  acceptsParking: boolean;
  maxCapacity: number | null;
  currentOccupancy: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'FINISHED' | 'CANCELLED';
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


