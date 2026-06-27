// src/pages/ServiceBookingRequestsPage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Listing Page
// Listagem homogênea de solicitações de booking (read-only)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { listActorServices } from '../api/services';
import { listServiceBookings, type ServiceBooking } from '../api/service-bookings';
import { getBookingDecision, type ServiceBookingDecision } from '../api/service-booking-decisions';
import { getActorProfile } from '../api/social-2.0';
import { showToast } from '../components/common/Toast';
import './ServiceBookingRequestsPage.css';

export default function ServiceBookingRequestsPage() {
  const { activeActor } = useActiveActor();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Array<ServiceBooking & { serviceName?: string; requesterName?: string; decision?: ServiceBookingDecision | null }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (activeActor) {
      loadServices();
    }
  }, [activeActor]);

  useEffect(() => {
    if (activeActor && services.length > 0) {
      loadBookings();
    }
  }, [activeActor, selectedServiceId, services]);

  const loadServices = async () => {
    if (!activeActor) return;

    try {
      const servicesData = await listActorServices(activeActor.actor_id, { status: 'active' });
      // View-model local {id,name}: o `id` é a chave de rota e DEVE vir do contrato vivo `serviceId`.
      setServices(servicesData.map(s => ({ id: s.serviceId, name: s.name })));
    } catch (err: any) {
      console.error('Erro ao carregar serviços:', err);
    }
  };

  const loadBookings = async () => {
    if (!activeActor) return;

    setIsLoading(true);
    setError(null);

    try {
      const allBookings: Array<ServiceBooking & { serviceName?: string; requesterName?: string; decision?: ServiceBookingDecision | null }> = [];

      // Buscar bookings de todos os serviços do prestador
      const servicesToCheck = selectedServiceId === 'all' 
        ? services 
        : services.filter(s => s.id === selectedServiceId);

      for (const service of servicesToCheck) {
        try {
          const serviceBookings = await listServiceBookings(service.id, { status: 'requested' });
          
          // Enriquecer com nome do serviço e do solicitante
          const enrichedBookings = await Promise.all(
            serviceBookings.map(async (booking) => {
              // Buscar nome do solicitante
              let requesterName: string | undefined;
              try {
                const requesterProfile = await getActorProfile(booking.requesterActorId);
                requesterName = requesterProfile.actor?.display_name || booking.requesterActorId;
              } catch {
                requesterName = booking.requesterActorId;
              }

              // Buscar decisão se existir
              let decision: ServiceBookingDecision | null = null;
              try {
                decision = await getBookingDecision(service.id, booking.bookingId);
              } catch {
                // Decisão não existe ainda
              }

              return {
                ...booking,
                serviceName: service.name,
                requesterName,
                decision,
              };
            })
          );

          allBookings.push(...enrichedBookings);
        } catch (err) {
          console.error(`Erro ao carregar bookings do serviço ${service.id}:`, err);
        }
      }

      // Ordenar por data de solicitação (mais recentes primeiro)
      allBookings.sort((a, b) => 
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      );

      setBookings(allBookings);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar solicitações');
      showToast(err.message || 'Erro ao carregar solicitações', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 ENTITY LISTING PAGE: CTAs explícitos para navegar para Action Page (decisão de booking)
  const handleNavigateToDecision = (booking: ServiceBooking) => {
    // Navegar para página dedicada de decisão de booking
    navigate(`/service-bookings/${booking.bookingId}/decision`);
  };

  const formatDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!activeActor) {
    return (
      <div className="service-booking-requests-page">
        <div className="error">Por favor, selecione um actor ativo</div>
      </div>
    );
  }

  return (
    <div className="service-booking-requests-page">
      <div className="page-header">
        <h1>Solicitações de Booking</h1>
        <p className="page-subtitle">Visualize solicitações recebidas para seus serviços</p>
      </div>

      {/* Filtro por Serviço */}
      <div className="filters-section">
        <label htmlFor="service-filter">Filtrar por serviço:</label>
        <select
          id="service-filter"
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="filter-select"
        >
          <option value="all">Todos os serviços</option>
          {services.map(service => (
            <option key={service.id} value={service.id}>{service.name}</option>
          ))}
        </select>
      </div>

      {/* Lista de Solicitações */}
      {isLoading ? (
        <div className="loading">Carregando solicitações...</div>
      ) : error ? (
        <div className="error">
          <p>{error}</p>
          <button onClick={loadBookings}>Tentar novamente</button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma solicitação pendente encontrada.</p>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => {
            const eventContext = booking.metadata?.origin === 'event_booking_request' 
              ? booking.metadata 
              : null;
            const hasDecision = booking.decision !== null && booking.decision !== undefined;

            return (
              <div key={booking.bookingId} className="booking-card">
                <div className="booking-header">
                  <h3>{booking.serviceName || 'Serviço'}</h3>
                  {hasDecision && (
                    <span className={`decision-badge decision-${booking.decision?.status}`}>
                      {booking.decision?.status === 'accepted' ? '✓ Aceito' : '✗ Recusado'}
                    </span>
                  )}
                  {!hasDecision && (
                    <span className="status-badge status-requested">Pendente</span>
                  )}
                </div>

                <div className="booking-info">
                  <div className="info-row">
                    <strong>Solicitante:</strong> {booking.requesterName || booking.requesterActorId}
                  </div>
                  <div className="info-row">
                    <strong>Solicitado em:</strong> {formatDateTime(booking.requestedAt)}
                  </div>
                  {booking.notes && (
                    <div className="info-row">
                      <strong>Mensagem:</strong>
                      <p className="booking-notes">{booking.notes}</p>
                    </div>
                  )}
                </div>

                {/* Contexto do Evento */}
                {eventContext && (
                  <div className="event-context">
                    <h4>📅 Contexto do Evento</h4>
                    <div className="event-info">
                      {eventContext.eventTitle && (
                        <div className="info-row">
                          <strong>Evento:</strong> {eventContext.eventTitle}
                        </div>
                      )}
                      {eventContext.eventStartTime && (
                        <div className="info-row">
                          <strong>Data/Hora Início:</strong> {formatDateTime(eventContext.eventStartTime)}
                        </div>
                      )}
                      {eventContext.eventEndTime && (
                        <div className="info-row">
                          <strong>Data/Hora Fim:</strong> {formatDateTime(eventContext.eventEndTime)}
                        </div>
                      )}
                      {eventContext.eventType && (
                        <div className="info-row">
                          <strong>Tipo:</strong> {eventContext.eventType}
                        </div>
                      )}
                      {eventContext.eventCityId && (
                        <div className="info-row">
                          <strong>Local:</strong> {eventContext.eventCityId}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Decisão Anterior */}
                {hasDecision && booking.decision && (
                  <div className="decision-info">
                    <p>
                      <strong>Decisão:</strong> {booking.decision.status === 'accepted' ? 'Aceito' : 'Recusado'} em {formatDateTime(booking.decision.decidedAt)}
                    </p>
                    {booking.decision.reason && (
                      <p><strong>Motivo:</strong> {booking.decision.reason}</p>
                    )}
                  </div>
                )}

                {/* 🔴 ENTITY LISTING PAGE: CTA explícito para navegar para Action Page (decisão) */}
                {!hasDecision && (
                  <div className="booking-actions">
                    <button
                      onClick={() => handleNavigateToDecision(booking)}
                      className="btn-primary"
                    >
                      Decidir sobre Booking
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




