// src/components/events/EventPage.tsx
// Página completa do evento (read-only, navegação para checkout)
import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { getEvent, getEventStats, getEventEconomy, getEventClosureSummary, getEventStateHistory, getEventAvailabilityPreview, getEventPosts, getEventParticipants, getEventMetrics, trackEventMetric, updateEvent, getEventById, publishEvent, type Event, type AvailabilityPreview as AvailabilityPreviewType } from '../../api/events';
import { getEventRFQs, type EventRFQ } from '../../api/event-rfq';
import { showToast } from '../../utils/toast';
import PostCard, { type PostCardData } from '../social/PostCard';
import EventStatusBadge from './EventStatusBadge';
import EventOrganizerPanel from './EventOrganizerPanel';
import AvailabilityPreview from './AvailabilityPreview';
import EventImpact from './EventImpact';
import EventNeedsList, { type EventNeed } from './EventNeedsList';
import EventServiceDiscoveryModal, { type SelectedService } from './EventServiceDiscoveryModal';
import EventServiceBookingRequestModal from './EventServiceBookingRequestModal';
import EventRFQCreateModal from './EventRFQCreateModal';
import EventRFQQuotesView from './EventRFQQuotesView';
import { getEventTrustSignals } from '../../utils/trustSignals';
import AgreementBanner from '../agreements/AgreementBanner';
import DisputeBanner from '../evidence/DisputeBanner';
import './EventPage.css';

export interface EventPageProps {
  eventId?: string; // Se não fornecido, pega da URL
  onNavigateToCheckout?: (type: 'ticket' | 'consumption' | 'parking') => void;
}

export default function EventPage({ eventId: propEventId, onNavigateToCheckout }: EventPageProps) {
  const eventId = propEventId || '';

  const [event, setEvent] = useState<Event | null>(null);
  const [eventStats, setEventStats] = useState<{
    soldCount: number;
    maxCapacity: number | null;
    remaining: number | null;
    occupancyPercent: number | null;
  } | null>(null);
  const [eventEconomy, setEventEconomy] = useState<{
    totalCollected: number;
    expectedTotal: number | null;
    participantsCount: number;
    ticketPriceCents: number | null;
    maxCapacity: number | null;
    lastUpdate: string;
  } | null>(null);
  const [eventClosureSummary, setEventClosureSummary] = useState<{
    participantsCount: number;
    totalCollected: number;
    startedAt: string;
    endedAt: string;
  } | null>(null);
  const [eventStateHistory, setEventStateHistory] = useState<Array<{
    state: string;
    changedAt: string;
  }>>([]);
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
  const [eventNeeds, setEventNeeds] = useState<EventNeed[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [isServiceDiscoveryOpen, setIsServiceDiscoveryOpen] = useState(false);
  const [bookingRequestService, setBookingRequestService] = useState<SelectedService | null>(null);
  const [eventRFQs, setEventRFQs] = useState<EventRFQ[]>([]);
  const [isRFQCreateOpen, setIsRFQCreateOpen] = useState(false);
  const [selectedRFQId, setSelectedRFQId] = useState<string | null>(null);

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

        // Carregar necessidades do evento (se existirem)
        if (eventData.metadata?.eventNeeds) {
          setEventNeeds((eventData.metadata.eventNeeds ?? []) as unknown as EventNeed[]);
        } else {
          setEventNeeds([]);
        }

        // Carregar serviços selecionados (se existirem)
        if (eventData.metadata?.selected_services) {
          setSelectedServices((eventData.metadata.selected_services ?? []) as unknown as SelectedService[]);
        } else {
          setSelectedServices([]);
        }

        // Carregar RFQs do evento
        try {
          const rfqsData = await getEventRFQs(eventId);
          setEventRFQs(rfqsData.rfqs || []);
          // Se houver RFQ aberto, selecionar o primeiro
          const openRFQ = rfqsData.rfqs?.find(rfq => rfq.status === 'open');
          if (openRFQ) {
            setSelectedRFQId(openRFQ.rfqId);
          }
        } catch (err) {
          console.warn('Erro ao carregar RFQs (não crítico):', err);
          setEventRFQs([]);
        }

        // Registrar visualização da página do evento
        trackEventMetric(eventId, 'VIEW', { source: 'event_page' });

        // Carregar estatísticas de ingressos
        try {
          const stats = await getEventStats(eventId);
          setEventStats(stats);
        } catch (err) {
          console.error('Erro ao carregar estatísticas:', err);
          // Fallback: usar currentOccupancy do evento se disponível
          if (eventData.currentOccupancy !== undefined && eventData.maxCapacity !== null) {
            setEventStats({
              soldCount: eventData.currentOccupancy,
              maxCapacity: eventData.maxCapacity,
              remaining: Math.max(0, eventData.maxCapacity - eventData.currentOccupancy),
              occupancyPercent: Math.round((eventData.currentOccupancy / eventData.maxCapacity) * 100),
            });
          }
        }

        // Carregar economia do evento
        try {
          const economy = await getEventEconomy(eventId);
          setEventEconomy(economy);
        } catch (err) {
          console.error('Erro ao carregar economia do evento:', err);
        }

        // Carregar resumo de fechamento do evento (se estiver concluído)
        if (eventData.status === 'FINISHED' || eventData.status === 'CANCELLED') {
          try {
            const closureSummary = await getEventClosureSummary(eventId);
            setEventClosureSummary(closureSummary);
          } catch (err) {
            console.error('Erro ao carregar resumo de fechamento do evento:', err);
          }
        }

        // Carregar histórico de estados do evento
        try {
          const stateHistory = await getEventStateHistory(eventId);
          setEventStateHistory(stateHistory);
        } catch (err) {
          console.error('Erro ao carregar histórico de estados do evento:', err);
        }

        // Carregar dados relacionados em paralelo
        const loadRelatedData = async () => {
          try {
            // Preview de disponibilidade
            if (eventData.status === 'PUBLISHED' || eventData.status === 'ONGOING') {
              try {
                const availabilityData = await getEventAvailabilityPreview(eventId);
                setAvailability(availabilityData);
              } catch (err) {
                console.error('Erro ao carregar disponibilidade:', err);
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
              console.error('Erro ao carregar posts relacionados:', err);
            }

            // Participantes
            try {
              const participantsData = await getEventParticipants(eventId, 20);
              setParticipants(participantsData.participants || []);
            } catch (err) {
              console.error('Erro ao carregar participantes:', err);
            }

            // Métricas (para otimizar CTAs)
            try {
              const metricsData = await getEventMetrics(eventId);
              setMetrics({ 
                byCTAType: metricsData.byCTAType,
                totalConversions: metricsData.totalConversions,
              });
            } catch (err) {
              console.error('Erro ao carregar métricas:', err);
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
            console.error('Erro ao carregar dados relacionados:', err);
          }
        };

        loadRelatedData();
      } catch (err) {
        console.error('Erro ao carregar evento:', err);
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
    const trustSignals = getEventTrustSignals({
      participantsCount: participants.length,
      hasImpact,
      totalConversions: metrics?.totalConversions,
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
    if (!event) return [];
    
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
              if (!event) return;
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
              if (!event) return;
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

    // Ordenar por taxa de conversão (maior primeiro)
    return ctas
      .sort((a, b) => b.rate - a.rate)
      .map((cta) => cta.component);
  };

  const renderTicketCTAText = () => {
    if (!event) return '💵 Comprar Ingresso';
    
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

      {/* Painel do ORGANIZADOR (owner-only como hint; autoridade real = backend, DECISION-0189A):
          Local (S2) · Vaquinha (S1) · Setores com meia-entrada legal (S3). Auto-oculta p/ não-dono. */}
      <EventOrganizerPanel eventId={eventId} />

      {/* Banner de Produção Assistida (XL/XXL) */}
      {(() => {
        const capacity = (event as any).metadata?.capacity as { capacityClass?: string } | undefined;
        const capacityClass = capacity?.capacityClass;
        const requiresAssistedProduction = capacityClass === 'XL' || capacityClass === 'XXL';

        if (!requiresAssistedProduction) {
          return null;
        }

        const openRFQ = eventRFQs.find(rfq => rfq.status === 'open');

        return (
          <div className="event-page-assisted-production-banner">
            <div className="assisted-production-banner-content">
              <div className="assisted-production-banner-icon">⚠️</div>
              <div className="assisted-production-banner-text">
                <strong>Este evento exige produção assistida.</strong>
                <p>Eventos {capacityClass} requerem RFQ para contratar serviços. Não é possível realizar booking direto.</p>
              </div>
            </div>
            <div className="assisted-production-banner-actions">
              {openRFQ ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setSelectedRFQId(openRFQ.rfqId);
                  }}
                >
                  Ver Propostas do RFQ
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setIsRFQCreateOpen(true);
                  }}
                >
                  Criar RFQ
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Banner de Status do Acordo */}
      {eventId && (
        <AgreementBanner
          contextType="event"
          contextId={eventId}
          onAgreementClick={() => {
            // TODO: Abrir modal ou navegar para visualização do acordo
            showToast('Visualização de acordo em desenvolvimento', 'info');
          }}
        />
      )}

      {/* Banner de Status de Disputa */}
      {eventId && (
        <DisputeBanner
          contextType="event"
          contextId={eventId}
          onViewEvidence={() => {
            // TODO: Abrir EvidenceViewer
            showToast('Visualização de evidências em desenvolvimento', 'info');
          }}
        />
      )}

      {/* Ingressos vendidos */}
      {eventStats && (
        <div className="event-page-tickets">
          <div className="event-page-tickets-info">
            <strong>Ingressos:</strong>{' '}
            {eventStats.maxCapacity !== null ? (
              <>
                <span className="event-page-tickets-sold">{eventStats.soldCount} vendidos</span>
                {' '}de {eventStats.maxCapacity}
                {eventStats.occupancyPercent !== null && (
                  <span className="event-page-tickets-percent"> ({eventStats.occupancyPercent}% ocupado)</span>
                )}
                {eventStats.remaining !== null && eventStats.remaining > 0 && (
                  <span className="event-page-tickets-remaining"> • {eventStats.remaining} disponíveis</span>
                )}
              </>
            ) : (
              <span className="event-page-tickets-sold">{eventStats.soldCount} participantes/ingressos confirmados</span>
            )}
          </div>
        </div>
      )}

      <div className="event-page-info">
        <div className="event-page-type">{formatEventType(event.eventType)}</div>
        {event.cityId && <div className="event-page-city">📍 {event.cityId}</div>}
      </div>

      {/* Economia do Evento */}
      {eventEconomy && eventEconomy.ticketPriceCents !== null && eventEconomy.ticketPriceCents > 0 && (
        <div className="event-page-economy">
          <h2>Economia do Evento</h2>
          <div className="event-page-economy-info">
            <div className="event-page-economy-item">
              <strong>Total Coletado:</strong>{' '}
              <span>R$ {(eventEconomy.totalCollected / 100).toFixed(2)}</span>
            </div>
            {eventEconomy.expectedTotal !== null && (
              <div className="event-page-economy-item">
                <strong>Total Esperado:</strong>{' '}
                <span>R$ {(eventEconomy.expectedTotal / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="event-page-economy-item">
              <strong>Participantes:</strong>{' '}
              <span>{eventEconomy.participantsCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Resumo do Evento (fechamento) */}
      {eventClosureSummary && (
        <div className="event-page-closure">
          <h2>Resumo do Evento</h2>
          <div className="event-page-closure-info">
            <div className="event-page-closure-item">
              <strong>Participantes:</strong>{' '}
              <span>{eventClosureSummary.participantsCount}</span>
            </div>
            {eventClosureSummary.totalCollected > 0 && (
              <div className="event-page-closure-item">
                <strong>Total Coletado:</strong>{' '}
                <span>R$ {(eventClosureSummary.totalCollected / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="event-page-closure-item">
              <strong>Iniciado em:</strong>{' '}
              <span>{formatDateTime(eventClosureSummary.startedAt, event.timezone)}</span>
            </div>
            <div className="event-page-closure-item">
              <strong>Finalizado em:</strong>{' '}
              <span>{formatDateTime(eventClosureSummary.endedAt, event.timezone)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Estados */}
      {eventStateHistory.length > 0 && (
        <div className="event-page-state-history">
          <h2>Histórico de Estados</h2>
          <div className="event-state-history-timeline">
            {eventStateHistory.map((entry, index) => (
              <div key={index} className="event-state-history-item">
                <div className="event-state-history-state">{entry.state}</div>
                <div className="event-state-history-date">{formatDateTime(entry.changedAt, event.timezone)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Descrição */}
      {event.description && (
        <div className="event-page-description">{event.description}</div>
      )}

      {/* Necessidades do Evento */}
      {(eventNeeds.length > 0 || event.metadata?.needsAssistanceEnabled) && (
        <div className="event-page-needs">
          <EventNeedsList
            needs={eventNeeds}
            eventId={eventId}
            onUpdate={async (updatedNeeds: EventNeed[]) => {
              try {
                // Buscar evento atual para preservar metadata existente
                const currentEvent = await getEventById(eventId);
                const currentMetadata = currentEvent.event.metadata || {};

                // Atualizar metadata com lista de necessidades
                await updateEvent(eventId, {
                  metadata: {
                    ...currentMetadata,
                    eventNeeds: updatedNeeds,
                  },
                });

                setEventNeeds(updatedNeeds);
                showToast('Lista de necessidades atualizada', 'success');
              } catch (err: any) {
                showToast(err.message || 'Erro ao atualizar necessidades', 'error');
              }
            }}
            canEdit={true}
          />
        </div>
      )}

      {/* Serviços Selecionados */}
      <div className="event-page-selected-services">
        <div className="selected-services-header">
          <h2>Artistas / Serviços Selecionados</h2>
          <button
            onClick={() => setIsServiceDiscoveryOpen(true)}
            className="btn-primary"
          >
            Buscar no Catálogo
          </button>
        </div>

        {selectedServices.length === 0 ? (
          <div className="selected-services-empty">
            <p>Nenhum serviço selecionado ainda.</p>
            <p className="empty-hint">
              Clique em "Buscar no Catálogo" para encontrar artistas e serviços para este evento.
            </p>
          </div>
        ) : (
          <div className="selected-services-list">
            {selectedServices.map((service) => (
              <div key={service.serviceId} className="selected-service-card">
                <div className="selected-service-info">
                  <h3>{service.serviceName}</h3>
                  {service.actorName && (
                    <p className="service-actor-name">Por: {service.actorName}</p>
                  )}
                  <p className="service-added-date">
                    Selecionado em: {new Date(service.addedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="selected-service-actions">
                  <button
                    onClick={() => setBookingRequestService(service)}
                    className="btn-request-booking"
                  >
                    Solicitar Booking
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const updated = selectedServices.filter(
                          s => s.serviceId !== service.serviceId
                        );
                        
                        // Buscar evento atual para preservar metadata existente
                        const currentEvent = await getEventById(eventId);
                        const currentMetadata = currentEvent.event.metadata || {};

                        // Atualizar metadata
                        await updateEvent(eventId, {
                          metadata: {
                            ...currentMetadata,
                            selected_services: updated,
                          },
                        });

                        setSelectedServices(updated);
                        showToast('Serviço removido', 'success');
                      } catch (err: any) {
                        showToast(err.message || 'Erro ao remover serviço', 'error');
                      }
                    }}
                    className="btn-remove-service"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
      {(() => {
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
      })()}

      {/* Estado do Evento */}
      {event.stateInfo && (
        <div className={`event-page-state event-page-state-${event.stateInfo.state.toLowerCase()}`}>
          <div className="event-page-state-message">
            {event.stateInfo.state === 'PRE' && '⏰'}
            {event.stateInfo.state === 'DURING' && '🎉'}
            {event.stateInfo.state === 'POST' && '✅'}
            {' '}
            {event.stateInfo.message}
          </div>
        </div>
      )}

      {/* CTAs - Adaptados por estado e otimizados por métricas */}
      <div className="event-page-ctas">
        {/* 🔴 ENTITY DETAIL PAGE: CTA explícito para Publicar (apenas para draft) */}
        {event.status === 'DRAFT' && (
          <button
            className="event-page-cta event-page-cta-primary"
            onClick={async () => {
              try {
                await publishEvent(event.id);
                showToast('Evento publicado com sucesso!', 'success');
                // Recarregar evento para atualizar status
                const updatedEvent = await getEvent(event.id);
                setEvent(updatedEvent);
              } catch (err: any) {
                showToast(err.message || 'Erro ao publicar evento', 'error');
              }
            }}
          >
            📢 Publicar Evento
          </button>
        )}

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

        {event.stateInfo?.state === 'DURING' && (
          <div>
            {/* Ordenar CTAs por performance (maior conversão primeiro) */}
            {renderDuringCTAs()}
          </div>
        )}

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

      {isCTADisabled && (
        <div className="event-page-disabled-message">
          {event.status === 'CANCELLED' && 'Este evento foi cancelado'}
          {event.status === 'FINISHED' && 'Este evento já foi finalizado'}
          {event.maxCapacity !== null && event.currentOccupancy >= event.maxCapacity && 'Ingressos esgotados'}
        </div>
      )}

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

      {/* Modal de Descoberta de Serviços */}
      <EventServiceDiscoveryModal
        isOpen={isServiceDiscoveryOpen}
        onClose={() => setIsServiceDiscoveryOpen(false)}
        onSelect={async (service: SelectedService) => {
          try {
            const updated = [...selectedServices, service];
            
            // Buscar evento atual para preservar metadata existente
            const currentEvent = await getEventById(eventId);
            const currentMetadata = currentEvent.event.metadata || {};

            // Atualizar metadata
            await updateEvent(eventId, {
              metadata: {
                ...currentMetadata,
                selected_services: updated,
              },
            });

            setSelectedServices(updated);
            setIsServiceDiscoveryOpen(false);
          } catch (err: any) {
            showToast(err.message || 'Erro ao salvar seleção', 'error');
          }
        }}
        eventContext={{
          categoryId: event?.metadata?.categoryId || null,
          cityId: event?.cityId || null,
          stateId: event?.metadata?.stateId || null,
          startDate: event?.startTime || undefined,
          endDate: event?.endTime || undefined,
        }}
        selectedServices={selectedServices}
      />

      {/* Modal de Solicitação de Booking */}
      {bookingRequestService && (
        <EventServiceBookingRequestModal
          isOpen={!!bookingRequestService}
          onClose={() => setBookingRequestService(null)}
          onSuccess={() => {
            // Recarregar dados se necessário
            // Por enquanto, apenas fechar o modal
          }}
          eventId={eventId}
          serviceId={bookingRequestService.serviceId}
          actorId={bookingRequestService.actorId}
          serviceName={bookingRequestService.serviceName}
          actorName={bookingRequestService.actorName}
        />
      )}

      {/* Modal de Criação de RFQ */}
      <EventRFQCreateModal
        isOpen={isRFQCreateOpen}
        onClose={() => setIsRFQCreateOpen(false)}
        onSuccess={async () => {
          // Recarregar RFQs
          try {
            const rfqsData = await getEventRFQs(eventId);
            setEventRFQs(rfqsData.rfqs || []);
            const openRFQ = rfqsData.rfqs?.find(rfq => rfq.status === 'open');
            if (openRFQ) {
              setSelectedRFQId(openRFQ.rfqId);
            }
          } catch (err) {
            console.error('Erro ao recarregar RFQs:', err);
          }
          setIsRFQCreateOpen(false);
        }}
        eventId={eventId}
      />

      {/* Modal de Visualização de Propostas do RFQ */}
      {selectedRFQId && (
        <EventRFQQuotesView
          eventId={eventId}
          rfqId={selectedRFQId}
        />
      )}
    </div>
  );
}




