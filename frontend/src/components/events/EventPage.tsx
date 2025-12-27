// src/components/events/EventPage.tsx
// Página completa do evento (read-only, navegação para checkout)
import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { getEvent, getEventAvailabilityPreview, getEventPosts, getEventParticipants, getEventMetrics, trackEventMetric, type Event, type AvailabilityPreview as AvailabilityPreviewType } from '../../api/events';
import PostCard, { type PostCardData } from '../social/PostCard';
import EventStatusBadge from './EventStatusBadge';
import AvailabilityPreview from './AvailabilityPreview';
import EventImpact from './EventImpact';
import { getEventTrustSignals } from '../../utils/trustSignals';
import { devLog } from '../../utils/devLog';
import './EventPage.css';

export interface EventPageProps {
  eventId?: string; // Se não fornecido, pega da URL
  onNavigateToCheckout?: (type: 'ticket' | 'consumption' | 'parking') => void;
}

export default function EventPage({ eventId: propEventId, onNavigateToCheckout }: EventPageProps) {
  const eventId = propEventId || '';

  const [event, setEvent] = useState<Event | null>(null);
  const [availability, setAvailability] = useState<AvailabilityPreviewType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<PostCardData[]>([]);
  const [participants, setParticipants] = useState<Array<{ globalUserId: string; checkInTime: string | null; joinedAt: string }>>([]);
  const [metrics, setMetrics] = useState<{
    byCTAType: {
      ticket?: { clicks: number; conversions: number };
      consumption?: { clicks: number; conversions: number };
      parking?: { clicks: number; conversions: number };
    };
    totalConversions?: number;
  } | null>(null);
  const [hasImpact, setHasImpact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setError('Evento não encontrado');
      setLoading(false);
      return;
    }

    const loadEvent = async () => {
      try {
        setLoading(true);
        const eventData = await getEvent(eventId);
        setEvent(eventData);

        // Registrar visualização da página do evento
        trackEventMetric(eventId, 'VIEW', { source: 'event_page' });

        // Carregar dados relacionados em paralelo
        const loadRelatedData = async () => {
          try {
            // Preview de disponibilidade
            if (eventData.status === 'PUBLISHED' || eventData.status === 'ONGOING') {
              try {
                const availabilityData = await getEventAvailabilityPreview(eventId);
                setAvailability(availabilityData);
              } catch (err) {
                devLog.error('Erro ao carregar disponibilidade:', err);
              }
            }

            // Posts relacionados
            try {
              const postsData = await getEventPosts(eventId, 10);
              // Converter para PostCardData
              const posts: PostCardData[] = (postsData.posts || []).map((p) => ({
                post_id: p.postId,
                actor: {
                  actor_id: p.globalUserId,
                  actor_type: 'user',
                  display_name: p.globalUserId.substring(0, 8) + '...', // Placeholder
                  avatar_url: null,
                },
                content: p.content,
                created_at: p.createdAt,
                media: p.media || [],
                reactions_count: 0,
                comments_count: 0,
                user_reaction: null,
              }));
              setRelatedPosts(posts);
            } catch (err) {
              devLog.error('Erro ao carregar posts relacionados:', err);
            }

            // Participantes
            try {
              const participantsData = await getEventParticipants(eventId, 20);
              setParticipants(participantsData.participants || []);
            } catch (err) {
              devLog.error('Erro ao carregar participantes:', err);
            }

            // Métricas (para otimizar CTAs)
            try {
              const metricsData = await getEventMetrics(eventId);
              setMetrics({ 
                byCTAType: metricsData.byCTAType,
                totalConversions: metricsData.totalConversions,
              });
            } catch (err) {
              devLog.error('Erro ao carregar métricas:', err);
            }

            // Verificar se evento gerou impacto (via EventImpact component logic)
            try {
              const { getLedgerSummary } = await import('../../api/social');
              const summary = await getLedgerSummary();
              const hasContributions = summary.group_contributions && summary.group_contributions.length > 0;
              const totalImpact = summary.total_profit_share_received_cents || 0;
              setHasImpact(hasContributions && totalImpact > 0);
            } catch (err) {
              // Não crítico - apenas não mostrar sinal de impacto
              setHasImpact(false);
            }
          } catch (err) {
            // Não bloqueia carregamento da página
            devLog.error('Erro ao carregar dados relacionados:', err);
          }
        };

        loadRelatedData();
      } catch (err) {
        devLog.error('Erro ao carregar evento:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar evento');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const formatEventType = (type: string): string => {
    const types: Record<string, string> = {
      SHOW: 'Show',
      CINEMA: 'Cinema',
      ESPORTE: 'Esporte',
      BAR: 'Bar',
      RESTAURANTE: 'Restaurante',
      FEIRA: 'Feira',
      WORKSHOP: 'Workshop',
      EXPOSICAO: 'Exposição',
      FESTIVAL: 'Festival',
      BALADA: 'Balada',
    };
    return types[type] || type;
  };

  const formatDateTime = (isoString: string, timezone: string): string => {
    const dt = DateTime.fromISO(isoString).setZone(timezone);
    return dt.toFormat("dd/MM/yyyy 'às' HH:mm");
  };

  const isCTADisabled = !event || 
                       event.status === 'CANCELLED' || 
                       event.status === 'FINISHED' ||
                       (event.maxCapacity !== null && event.currentOccupancy !== undefined && event.currentOccupancy >= event.maxCapacity);

  // Funções de renderização para evitar JSX complexo aninhado
  const renderTrustSignals = () => {
    if (!event) {
      return null;
    }

    const trustSignals = getEventTrustSignals({
      participantsCount: participants.length,
      hasImpact,
      totalConversions: metrics?.totalConversions,
      created_at: event.created_at,
      updated_at: event.updated_at,
    });

    if (trustSignals.length === 0) {
      return null;
    }

    return (
      <div className="event-page-trust-signals">
        {trustSignals.map((signal, index) => (
          <div key={index} className={`event-trust-signal event-trust-signal--${signal.type}`}>
            {signal.icon && <span className="trust-signal-icon">{signal.icon}</span>}
            <span className="trust-signal-label">{signal.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderDuringCTAs = () => {
    if (!event) {
      return null;
    }

    const ctas = [];
    
    if (event.acceptsConsumption) {
      const consumptionMetrics = metrics?.byCTAType?.consumption;
      const consumptionRate = consumptionMetrics && consumptionMetrics.clicks > 0
        ? consumptionMetrics.conversions / consumptionMetrics.clicks
        : 0;
      
      ctas.push({
        type: 'consumption',
        rate: consumptionRate,
        component: (
          <button
            key="consumption"
            className="event-page-cta event-page-cta-primary"
            onClick={() => {
              trackEventMetric(event.id, 'CTA_CLICK', { ctaType: 'consumption' });
              if (onNavigateToCheckout) {
                onNavigateToCheckout('consumption');
              } else {
                window.location.href = `/events/${event.id}/consumption`;
              }
            }}
          >
            🍽️ Consumir no Local
          </button>
        ),
      });
    }

    if (event.acceptsParking) {
      const parkingMetrics = metrics?.byCTAType?.parking;
      const parkingRate = parkingMetrics && parkingMetrics.clicks > 0
        ? parkingMetrics.conversions / parkingMetrics.clicks
        : 0;
      
      ctas.push({
        type: 'parking',
        rate: parkingRate,
        component: (
          <button
            key="parking"
            className="event-page-cta"
            onClick={() => {
              trackEventMetric(event.id, 'CTA_CLICK', { ctaType: 'parking' });
              if (onNavigateToCheckout) {
                onNavigateToCheckout('parking');
              } else {
                window.location.href = `/events/${event.id}/parking`;
              }
            }}
          >
            🚗 Estacionamento
          </button>
        ),
      });
    }

    if (ctas.length === 0) {
      return null;
    }

    // Ordenar por taxa de conversão (maior primeiro)
    return (
      <div>
        {ctas
          .sort((a, b) => b.rate - a.rate)
          .map((cta) => cta.component)}
      </div>
    );
  };

  const renderTicketCTAText = () => {
    if (!event) {
      return '💵 Comprar Ingresso';
    }

    const ticketMetrics = metrics?.byCTAType?.ticket;
    const conversionRate = ticketMetrics && ticketMetrics.clicks > 0
      ? ticketMetrics.conversions / ticketMetrics.clicks
      : 0;

    if (event.stateInfo?.isSoon) {
      return conversionRate > 0.3 ? '🎯 Últimas vagas!' : '🚀 Garantir meu lugar';
    }
    return conversionRate > 0.3 ? '💎 Garanta seu ingresso' : '💵 Comprar Ingresso';
  };

  const renderTimelineTitle = () => {
    if (!event) return '📝 Timeline do Evento';
    if (event.stateInfo?.state === 'PRE') return '📝 Preparação do Evento';
    if (event.stateInfo?.state === 'DURING') return '🎉 Acontecendo Agora';
    if (event.stateInfo?.state === 'POST') return '📸 Replay do Evento';
    return '📝 Timeline do Evento';
  };

  const renderAvailability = () => {
    if (!event) {
      return null;
    }

    if (availability && availability.nextAvailableSlots.length > 0) {
      return (
        <div className="event-page-availability">
          <h2>Próximos horários disponíveis</h2>
          <AvailabilityPreview slots={availability.nextAvailableSlots} timezone={availability.timezone} />
        </div>
      );
    }
    
    if (event.maxCapacity !== null && event.currentOccupancy >= event.maxCapacity) {
      return <div className="event-page-sold-out">⚠️ Esgotado</div>;
    }
    
    return <div className="event-page-no-availability">Fora do horário ou sem disponibilidade</div>;
  };

  const renderStateInfo = () => {
    if (!event || !event.stateInfo) {
      return null;
    }

    const stateIcon = event.stateInfo.state === 'PRE' ? '⏰' 
      : event.stateInfo.state === 'DURING' ? '🎉' 
      : '✅';

    return (
      <div className={`event-page-state event-page-state-${event.stateInfo.state.toLowerCase()}`}>
        <div className="event-page-state-message">
          {stateIcon} {event.stateInfo.message}
        </div>
      </div>
    );
  };

  const renderDisabledMessage = () => {
    if (!event || !isCTADisabled) {
      return null;
    }

    if (event.status === 'CANCELLED') {
      return <div className="event-page-disabled-message">Este evento foi cancelado</div>;
    }

    if (event.status === 'FINISHED') {
      return <div className="event-page-disabled-message">Este evento já foi finalizado</div>;
    }

    if (event.maxCapacity !== null && event.currentOccupancy >= event.maxCapacity) {
      return <div className="event-page-disabled-message">Ingressos esgotados</div>;
    }

    return null;
  };

  if (loading) {
    return (
      <div className="event-page">
        <div className="event-page-loading">Carregando evento...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="event-page">
        <div className="event-page-error">
          {error || 'Evento não encontrado'}
        </div>
      </div>
    );
  }

  return (
    <div className="event-page">
      {/* Header */}
      <div className="event-page-header">
        <h1 className="event-page-title">{event.title}</h1>
        <EventStatusBadge status={event.status} />
      </div>

      <div className="event-page-info">
        <div className="event-page-type">{formatEventType(event.eventType)}</div>
        {event.cityId && <div className="event-page-city">📍 {event.cityId}</div>}
      </div>

      {/* Descrição */}
      {event.description && (
        <div className="event-page-description">{event.description}</div>
      )}

      {/* Sinais de Confiança */}
      {renderTrustSignals()}

      {/* Datas */}
      <div className="event-page-dates">
        <div className="event-page-date">
          <strong>Início:</strong> {formatDateTime(event.startTime, event.timezone)}
        </div>
        <div className="event-page-date">
          <strong>Fim:</strong> {event.endTime ? formatDateTime(event.endTime, event.timezone) : 'Não definido'}
        </div>
      </div>

      {/* Agenda (Preview) */}
      {renderAvailability()}

      {/* Estado do Evento */}
      {renderStateInfo()}

      {/* CTAs - Adaptados por estado e otimizados por métricas */}
      <div className="event-page-ctas">
        {event.stateInfo?.state === 'PRE' && event.ticketPrice !== null && event.ticketPrice > 0 && (
          <button
            className="event-page-cta event-page-cta-primary"
            disabled={isCTADisabled}
            onClick={() => {
              trackEventMetric(event.id, 'CTA_CLICK', { ctaType: 'ticket' });
              if (onNavigateToCheckout) {
                onNavigateToCheckout('ticket');
              } else {
                window.location.href = `/events/${event.id}/tickets`;
              }
            }}
          >
            {/* Otimizar copy baseado em métricas */}
            {renderTicketCTAText()}
            {event.ticketPrice > 0 && ` (R$ ${event.ticketPrice.toFixed(2)})`}
          </button>
        )}

        {event.stateInfo?.state === 'DURING' && renderDuringCTAs()}

        {event.stateInfo?.state === 'POST' && (
          <div className="event-page-post-cta">
            <p>Este evento já foi finalizado. Veja o que aconteceu:</p>
          </div>
        )}

        {/* CTAs tradicionais (fallback se state não estiver disponível) */}
        {!event.stateInfo && event.ticketPrice !== null && event.ticketPrice > 0 && (
          <button
            className="event-page-cta event-page-cta-primary"
            disabled={isCTADisabled}
            onClick={() => {
              trackEventMetric(event.id, 'CTA_CLICK', { ctaType: 'ticket' });
              if (onNavigateToCheckout) {
                onNavigateToCheckout('ticket');
              } else {
                window.location.href = `/events/${event.id}/tickets`;
              }
            }}
          >
            💵 Comprar Ingresso {event.ticketPrice > 0 && `(R$ ${event.ticketPrice.toFixed(2)})`}
          </button>
        )}

        {!event.stateInfo && event.acceptsConsumption && (
          <button
            className="event-page-cta"
            disabled={isCTADisabled}
            onClick={() => {
              // Registrar clique no CTA
              trackEventMetric(event.id, 'CTA_CLICK', { ctaType: 'consumption' });
              
              if (onNavigateToCheckout) {
                onNavigateToCheckout('consumption');
              } else {
                window.location.href = `/events/${event.id}/consumption`;
              }
            }}
          >
            🍽️ Consumir no Local
          </button>
        )}

        {!event.stateInfo && event.acceptsParking && (
          <button
            className="event-page-cta"
            disabled={isCTADisabled}
            onClick={() => {
              // Registrar clique no CTA
              trackEventMetric(event.id, 'CTA_CLICK', { ctaType: 'parking' });
              
              if (onNavigateToCheckout) {
                onNavigateToCheckout('parking');
              } else {
                window.location.href = `/events/${event.id}/parking`;
              }
            }}
          >
            🚗 Estacionamento
          </button>
        )}
      </div>

      {renderDisabledMessage()}

      {/* Impacto Gerado pelo Evento */}
      <EventImpact eventId={event.id} />

      {/* Timeline de Posts Relacionados - Adaptada por estado */}
      {relatedPosts.length > 0 && (
        <div className="event-page-timeline">
          <h2 className="event-page-section-title">
            {renderTimelineTitle()}
          </h2>
          <div className="event-page-posts">
            {relatedPosts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                onReaction={async () => {}}
                onComment={async () => {}}
                onCTAConfirmed={async () => {}}
                onVote={async () => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* Participantes */}
      {participants.length > 0 && (
        <div className="event-page-participants">
          <h2 className="event-page-section-title">
            👥 Participantes ({participants.length})
          </h2>
          <div className="event-page-participants-list">
            {participants.slice(0, 10).map((participant, index) => (
              <div key={participant.globalUserId || index} className="event-page-participant">
                <div className="event-page-participant-info">
                  <span className="event-page-participant-id">
                    {participant.globalUserId.substring(0, 8)}...
                  </span>
                  {participant.checkInTime && (
                    <span className="event-page-participant-checkin">✓ Check-in realizado</span>
                  )}
                </div>
              </div>
            ))}
            {participants.length > 10 && (
              <div className="event-page-participants-more">
                +{participants.length - 10} participantes
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




