// src/services/feed/event-feed-adapter.ts
// FeedAdapter para eventos conforme CONTRATO DE EVENTOS v1
// FASE 6A: INTEGRAÇÃO COM FEED

import type { FeedEvent, FeedItem } from '@unificard/contracts';

/**
 * Mapeia event_type para intent do feed
 * CONTRATO v1: event_type governa UI, economia, visibilidade e feed
 */
export function mapEventTypeToIntent(eventType: string): string {
  const intentMap: Record<string, string> = {
    cultural: 'cultural_event',
    gastronomic: 'gastronomic_event',
    social: 'social_event',
    professional: 'professional_event',
    community: 'community_event',
    spiritual: 'spiritual_event',
    sports: 'sports_event',
    private: 'private_event',
  };

  return intentMap[eventType] || 'event';
}

/**
 * Calcula score de prioridade do feed para eventos
 * CONTRATO v1: Score baseado em event_type
 * 
 * Prioridades:
 * - cultural, professional, community = alta (50)
 * - gastronomic, spiritual, sports = média (30)
 * - social = média (30)
 * - private = não aparece (0)
 */
export function calculateEventFeedScore(eventType: string): number {
  const scoreMap: Record<string, number> = {
    cultural: 50,      // Prioridade alta
    professional: 50,  // Prioridade alta
    community: 50,    // Prioridade alta
    gastronomic: 30,  // Prioridade média
    spiritual: 30,    // Prioridade média
    sports: 30,       // Prioridade média
    social: 30,       // Prioridade média
    private: 0,       // Não aparece no feed
  };

  return scoreMap[eventType] || 20; // Default: prioridade baixa
}

/**
 * Adapta evento da tabela events para FeedEvent
 * CONTRATO v1: Usa campos canônicos (datetime_start, datetime_end, status, visibility)
 */
export function adaptEventToFeedEvent(eventRow: {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_subtype: string | null;
  datetime_start: Date;
  datetime_end: Date | null;
  status: string;
  visibility: string;
  ticket_price_cents: number | null;
  max_attendees: number | null;
  city_id: string | null;
  state_id: string | null;
  country_id: string | null;
  created_at: Date;
}): FeedEvent {
  return {
    id: eventRow.id,
    title: eventRow.title,
    eventType: eventRow.event_type,
    startTime: eventRow.datetime_start.toISOString(),
    endTime: eventRow.datetime_end?.toISOString() || null,
    cityId: eventRow.city_id,
    ticketPrice: eventRow.ticket_price_cents,
    acceptsConsumption: false, // TODO: Implementar quando houver campo
    status: eventRow.status,
    description: eventRow.description,
    maxCapacity: eventRow.max_attendees,
    currentOccupancy: 0, // TODO: Calcular de event_attendees quando necessário
    timezone: 'America/Sao_Paulo', // TODO: Obter de metadata ou campo específico
  };
}

/**
 * Adapta evento para FeedItem (EVENT_STANDALONE)
 */
export function adaptEventToFeedItem(eventRow: {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_subtype: string | null;
  datetime_start: Date;
  datetime_end: Date | null;
  status: string;
  visibility: string;
  ticket_price_cents: number | null;
  max_attendees: number | null;
  city_id: string | null;
  state_id: string | null;
  country_id: string | null;
  created_at: Date;
}): FeedItem {
  const feedEvent = adaptEventToFeedEvent(eventRow);

  return {
    type: 'EVENT_STANDALONE',
    id: eventRow.id,
    createdAt: eventRow.created_at.toISOString(),
    event: feedEvent,
  };
}

/**
 * Filtra eventos por status e visibility
 * CONTRATO v1: Apenas status='published' aparece no feed
 * CONTRATO v1: Visibility é respeitada (public, group, followers, private, unlisted)
 */
export function shouldEventAppearInFeed(
  status: string,
  visibility: string,
  actorId?: string // Para validar visibility 'followers' ou 'group'
): boolean {
  // Apenas eventos publicados aparecem
  if (status !== 'published') {
    return false;
  }

  // Eventos privados não aparecem no feed público
  if (visibility === 'private') {
    return false;
  }

  // Eventos 'unlisted' podem aparecer, mas não são listados diretamente
  // (podem aparecer via busca ou link direto)
  // Por enquanto, incluímos no feed

  // TODO: Validar visibility 'group' e 'followers' quando houver contexto de actor
  // Por enquanto, apenas 'public' e 'unlisted' aparecem no feed público

  return visibility === 'public' || visibility === 'unlisted';
}

