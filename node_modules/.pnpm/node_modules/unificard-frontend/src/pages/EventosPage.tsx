// src/pages/EventosPage.tsx
// Página de listagem de eventos - Integração mínima com backend
// CONTRATO: Usa feed para buscar eventos, wizard é único fluxo de criação

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { getSocialFeed } from '../api/social';
import { getUnifiedFeed } from '../api/feed';
import { publishEvent } from '../api/events';
import EventCard from '../components/events/EventCard';
import { validateActiveActor } from '../utils/guardrails';
import { showToast } from '../components/common/Toast';
import type { FeedItem } from '@unificard/contracts';
import './EventosPage.css';

interface EventFromFeed {
  eventId: string;
  title: string;
  eventType: string;
  cityId: string | null;
  status: string;
  ticketPrice: number | null;
  acceptsConsumption: boolean;
  actor_id?: string;
  actor_type?: string;
}

export default function EventosPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [events, setEvents] = useState<EventFromFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  // Carregar eventos via feed
  useEffect(() => {
    loadEvents();
  }, [activeActor]);

  const loadEvents = async () => {
    if (!validateActiveActor(activeActor)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // UNIFICADO: Usar exatamente a mesma lógica do SocialFeed2
      // 1. Buscar feed social (posts)
      if (!activeActor) {
        setIsLoading(false);
        return;
      }
      
      const feedData = await getSocialFeed({
        actor_type: activeActor.actor_type as 'user' | 'page',
        actor_id: activeActor.actor_id,
        actor_status: activeActor.company_status,
        limit: 50,
      });

      // 2. Buscar feed unificado (eventos standalone) - mesma fonte do feed
      const unifiedData = await getUnifiedFeed({ limit: 50 });

      // 3. Extrair eventos de posts com intent=event ou linked_event
      const eventItems: EventFromFeed[] = [];
      
      if (feedData.posts) {
        for (const post of feedData.posts) {
          // Posts com linked_event
          if (post.linked_event) {
            eventItems.push({
              eventId: post.linked_event.id,
              title: post.linked_event.title,
              eventType: 'cultural', // linked_event não tem eventType, usar default
              cityId: post.linked_event.location_cultural_profile_id || null,
              status: 'published',
              ticketPrice: null,
              acceptsConsumption: false,
              actor_id: post.actor?.actor_id,
              actor_type: post.actor?.actor_type,
            });
          }
          // Posts com intent=event
          else if (post.intent === 'event' && post.intent_metadata) {
            const metadata = post.intent_metadata;
            if (metadata.event_id) {
              eventItems.push({
                eventId: metadata.event_id,
                title: metadata.title || post.content?.substring(0, 50) || 'Evento',
                eventType: metadata.event_type || 'cultural',
                cityId: metadata.city_id || null,
                status: metadata.status || 'published',
                ticketPrice: metadata.ticket_price_cents ? metadata.ticket_price_cents / 100 : null,
                acceptsConsumption: metadata.accepts_consumption || false,
                actor_id: post.actor?.actor_id,
                actor_type: post.actor?.actor_type,
              });
            }
          }
        }
      }

      // 4. Extrair eventos standalone do feed unificado (mesma lógica do SocialFeed2)
      if (unifiedData.items) {
        const standaloneEvents = unifiedData.items
          .filter((item: FeedItem): item is Extract<FeedItem, { type: 'EVENT_STANDALONE' }> => 
            item.type === 'EVENT_STANDALONE' && item.event !== undefined
          )
          .map((item) => ({
            eventId: item.event.id,
            title: item.event.title,
            eventType: item.event.eventType,
            cityId: item.event.cityId,
            status: item.event.status,
            ticketPrice: item.event.ticketPrice ? item.event.ticketPrice / 100 : null,
            acceptsConsumption: item.event.acceptsConsumption || false,
            actor_id: undefined, // Eventos standalone não têm actor direto no feed
            actor_type: undefined,
          }));
        
        eventItems.push(...standaloneEvents);
      }

      // 5. Remover duplicatas por eventId
      const uniqueEvents = Array.from(
        new Map(eventItems.map(e => [e.eventId, e])).values()
      );

      setEvents(uniqueEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar eventos');
      console.error('Erro ao carregar eventos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Wizard é o único fluxo de criação
    navigate('/events/new');
  };

  const handlePublishEvent = async (eventId: string) => {
    setIsPublishing(eventId);

    try {
      await publishEvent(eventId);
      showToast('Evento publicado!', 'success');
      loadEvents();
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao publicar evento';
      
      // Tratar erro 403 (débito pendente)
      if (errorMessage.includes('débito pendente') || errorMessage.includes('bloqueada')) {
        showToast(errorMessage, 'error');
      } else {
        showToast(errorMessage, 'error');
      }
      console.error('Erro ao publicar evento:', err);
    } finally {
      setIsPublishing(null);
    }
  };

  const isEventOwner = (event: EventFromFeed): boolean => {
    if (!activeActor) return false;
    return (
      event.actor_id === activeActor.actor_id &&
      event.actor_type === activeActor.actor_type
    );
  };

  if (isLoading) {
    return (
      <div className="eventos-page">
        <div className="eventos-loading">Carregando eventos...</div>
      </div>
    );
  }

  return (
    <div className="eventos-page">
      <div className="eventos-header">
        <h1>🎭 Eventos</h1>
        <button
          className="eventos-create-button"
          onClick={handleCreateClick}
          type="button"
        >
          + Criar evento
        </button>
      </div>

      {error && (
        <div className="eventos-error">
          {error}
        </div>
      )}

      {events.length === 0 && !error && (
        <div className="eventos-empty">
          <p>Nenhum evento encontrado.</p>
          <p>Crie seu primeiro evento!</p>
        </div>
      )}

      <div className="eventos-list">
        {events.map((event) => (
          <div key={event.eventId} className="eventos-item">
            <EventCard
              eventId={event.eventId}
              title={event.title}
              eventType={event.eventType}
              cityId={event.cityId}
              status={event.status}
              ticketPrice={event.ticketPrice}
              acceptsConsumption={event.acceptsConsumption}
              onClick={() => navigate(`/events/${event.eventId}`)}
            />
            {isEventOwner(event) && event.status === 'draft' && (
              <button
                className="eventos-publish-button"
                onClick={() => handlePublishEvent(event.eventId)}
                disabled={isPublishing === event.eventId}
              >
                {isPublishing === event.eventId ? 'Publicando...' : 'Publicar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
