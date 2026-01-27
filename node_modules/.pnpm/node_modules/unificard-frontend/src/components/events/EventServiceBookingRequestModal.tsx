// src/components/events/EventServiceBookingRequestModal.tsx
// Modal de Solicitação de Booking Contextual para Eventos
// SPRINT: Eventos → Service Booking

import { useState, useEffect } from 'react';
import { getService } from '../../api/services';
import { listServiceAvailabilities, type ServiceAvailability } from '../../api/service-availability';
import { createServiceBooking, type CreateBookingInput } from '../../api/service-bookings';
import { getEvent } from '../../api/events';
import { showToast } from '../../utils/toast';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import CompatibilityModal from '../compatibility/CompatibilityModal';
import type { CompatibilityResult, EventCapacityMetadata, VenueInfrastructureMetadata, ServiceSetupPackage } from '../../types/compatibility';
import { useAgreementValidation } from '../../hooks/useAgreementValidation';
import BlockedButton from '../common/BlockedButton';
import AgreementSummary from '../agreements/AgreementSummary';
import '../agreements/AgreementSection.css';
import './EventServiceBookingRequestModal.css';

export interface EventServiceBookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventId: string;
  serviceId: string;
  actorId: string; // Prestador
  serviceName: string;
  actorName: string | null;
}

export default function EventServiceBookingRequestModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  serviceId,
  actorId,
  serviceName,
  actorName,
}: EventServiceBookingRequestModalProps) {
  const { activeActor } = useActiveActor();
  const [event, setEvent] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [availabilities, setAvailabilities] = useState<ServiceAvailability[]>([]);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);
  const [eventCapacity, setEventCapacity] = useState<EventCapacityMetadata | null>(null);
  const [venueInfrastructure, setVenueInfrastructure] = useState<VenueInfrastructureMetadata | null>(null);
  const [serviceSetups, setServiceSetups] = useState<ServiceSetupPackage[]>([]);

  // 🔴 BLINDAGEM: Validar acordo antes de permitir booking
  const agreementValidation = useAgreementValidation('event', eventId, true);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, eventId, serviceId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carregar evento
      const eventData = await getEvent(eventId);
      setEvent(eventData);

      // Carregar serviço
      const serviceData = await getService(serviceId);
      setService(serviceData);

      // Extrair setups do serviço
      const setups = (serviceData.metadata?.setups as any)?.setups || [];
      setServiceSetups(setups);

      // Extrair capacidade e infraestrutura do evento
      const capacity = (eventData as any).metadata?.capacity as EventCapacityMetadata | undefined;
      const venueInfra = (eventData as any).metadata?.venueInfrastructure as VenueInfrastructureMetadata | undefined;
      
      if (capacity) {
        setEventCapacity(capacity);
      }
      if (venueInfra) {
        setVenueInfrastructure(venueInfra);
      }

      // Carregar disponibilidades do serviço
      const availData = await listServiceAvailabilities(serviceId, { status: 'active' });
      // Filtrar apenas disponibilidades futuras
      const now = new Date();
      const futureAvailabilities = availData.filter(av => {
        const endDate = new Date(av.endDatetime);
        return endDate > now;
      });
      setAvailabilities(futureAvailabilities);
      
      // Se houver apenas uma disponibilidade, selecionar automaticamente
      if (futureAvailabilities.length === 1) {
        setSelectedAvailabilityId(futureAvailabilities[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
      showToast(err.message || 'Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAvailabilityId) {
      showToast('Selecione uma disponibilidade', 'error');
      return;
    }

    if (!activeActor) {
      showToast('Actor ativo não encontrado', 'error');
      return;
    }

    // Se houver dados de compatibilidade, mostrar modal antes de enviar
    if (eventCapacity && venueInfrastructure && serviceSetups.length > 0) {
      setIsCompatibilityModalOpen(true);
      return;
    }

    // Se não houver dados de compatibilidade, prosseguir diretamente
    await submitBooking();
  };

  const submitBooking = async () => {
    if (!selectedAvailabilityId || !activeActor) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const bookingInput: CreateBookingInput = {
        serviceId,
        availabilityId: selectedAvailabilityId,
        requesterActorId: activeActor.actor_id,
        notes: message.trim() || null,
        metadata: {
          origin: 'event_booking_request',
          eventId,
          eventTitle: event?.title || null,
          eventStartTime: event?.startTime || null,
          eventEndTime: event?.endTime || null,
          eventType: event?.eventType || null,
          eventCityId: event?.cityId || null,
        },
      };

      await createServiceBooking(serviceId, bookingInput);

      showToast('Solicitação de booking enviada com sucesso! O prestador precisa aceitar.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar solicitação');
      showToast(err.message || 'Erro ao enviar solicitação', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompatibilityConfirm = async (setupId: string, compatibility: CompatibilityResult) => {
    setIsCompatibilityModalOpen(false);

    // Se estiver BLOCKED ou requerer produção assistida, não prosseguir
    if (compatibility.status === 'BLOCKED' || compatibility.requiresProductionAssistance) {
      showToast('Não é possível criar booking devido a incompatibilidade técnica ou requisito de produção assistida.', 'error');
      return;
    }

    // Se for WARNING, já foi confirmado pelo usuário no modal
    // Prosseguir com o booking
    await submitBooking();
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

  if (!isOpen) return null;

  return (
    <div className="event-booking-request-modal-overlay" onClick={onClose}>
      <div className="event-booking-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Solicitar Booking</h2>
          <button onClick={onClose} className="modal-close-btn">×</button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="loading">Carregando informações...</div>
          ) : error ? (
            <div className="error">
              <p>{error}</p>
              <button onClick={loadData}>Tentar novamente</button>
            </div>
          ) : (
            <>
              {/* Informações do Evento */}
              <div className="info-section">
                <h3>Informações do Evento</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>Evento:</strong> {event?.title || 'N/A'}
                  </div>
                  {event?.startTime && (
                    <div className="info-item">
                      <strong>Data/Hora Início:</strong> {formatDateTime(event.startTime)}
                    </div>
                  )}
                  {event?.endTime && (
                    <div className="info-item">
                      <strong>Data/Hora Fim:</strong> {formatDateTime(event.endTime)}
                    </div>
                  )}
                  {event?.eventType && (
                    <div className="info-item">
                      <strong>Tipo:</strong> {event.eventType}
                    </div>
                  )}
                  {event?.cityId && (
                    <div className="info-item">
                      <strong>Local:</strong> {event.cityId}
                    </div>
                  )}
                </div>
              </div>

              {/* Informações do Serviço */}
              <div className="info-section">
                <h3>Serviço / Artista</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>Serviço:</strong> {serviceName}
                  </div>
                  {actorName && (
                    <div className="info-item">
                      <strong>Prestador:</strong> {actorName}
                    </div>
                  )}
                </div>
              </div>

              {/* Seleção de Disponibilidade */}
              <div className="info-section">
                <h3>Selecione a Disponibilidade *</h3>
                {availabilities.length === 0 ? (
                  <div className="no-availability">
                    <p>Nenhuma disponibilidade ativa encontrada para este serviço.</p>
                    <p className="hint">O prestador precisa criar disponibilidades antes de receber solicitações.</p>
                  </div>
                ) : (
                  <div className="availabilities-list">
                    {availabilities.map((av) => (
                      <label
                        key={av.id}
                        className={`availability-option ${selectedAvailabilityId === av.id ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="availability"
                          value={av.id}
                          checked={selectedAvailabilityId === av.id}
                          onChange={(e) => setSelectedAvailabilityId(e.target.value)}
                        />
                        <div className="availability-info">
                          <div className="availability-dates">
                            <span className="availability-start">
                              De: {formatDateTime(av.startDatetime)}
                            </span>
                            <span className="availability-end">
                              Até: {formatDateTime(av.endDatetime)}
                            </span>
                          </div>
                          {av.capacity && (
                            <div className="availability-capacity">
                              Capacidade: {av.capacity}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 🔴 BLINDAGEM: Seção de Acordo */}
              {!agreementValidation.isLoading && (
                <div className="info-section agreement-section">
                  <h3>Acordo de Negociação</h3>
                  {agreementValidation.agreement && agreementValidation.isFinalized ? (
                    <>
                      <div className="agreement-finalized-badge">
                        ✓ Acordo Finalizado
                      </div>
                      <AgreementSummary agreement={agreementValidation.agreement} />
                      <div className="agreement-legal-notice">
                        <small>
                          ℹ️ Este acordo é registrado e utilizado em caso de disputa. O valor do booking será baseado neste acordo.
                        </small>
                      </div>
                    </>
                  ) : agreementValidation.agreement && !agreementValidation.isFinalized ? (
                    <div className="agreement-blocking-warning">
                      <strong>⚠️ Negociação em andamento</strong>
                      <p>{agreementValidation.blockingReason}</p>
                      <AgreementSummary agreement={agreementValidation.agreement} />
                    </div>
                  ) : (
                    <div className="agreement-missing-warning">
                      <strong>⚠️ Acordo necessário</strong>
                      <p>Este serviço exige acordo fechado na plataforma. Crie um acordo antes de solicitar o booking.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mensagem Opcional */}
              <div className="info-section">
                <h3>Mensagem para o Prestador (Opcional)</h3>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Adicione informações sobre o evento, expectativas, ou qualquer contexto relevante..."
                  className="message-textarea"
                  rows={4}
                />
              </div>

              {/* Aviso Importante */}
              <div className="warning-banner">
                <p>
                  <strong>⚠️ Esta é uma SOLICITAÇÃO, não uma confirmação.</strong>
                </p>
                <p>
                  O prestador receberá sua solicitação e precisará aceitar ou recusar manualmente.
                  Nenhum booking será confirmado automaticamente.
                </p>
              </div>

              {/* Ações */}
              <div className="modal-actions">
                <button onClick={onClose} className="btn-cancel" disabled={isSubmitting}>
                  Cancelar
                </button>
                {agreementValidation.canProceed ? (
                  <button
                    onClick={handleSubmit}
                    className="btn-submit"
                    disabled={isSubmitting || !selectedAvailabilityId || availabilities.length === 0}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
                  </button>
                ) : (
                  <BlockedButton
                    reason={agreementValidation.blockingReason || 'Acordo não finalizado'}
                    className="btn-submit"
                  >
                    Enviar Solicitação
                  </BlockedButton>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Compatibilidade */}
      <CompatibilityModal
        isOpen={isCompatibilityModalOpen}
        onClose={() => setIsCompatibilityModalOpen(false)}
        onConfirm={handleCompatibilityConfirm}
        eventCapacity={eventCapacity || undefined}
        venueInfrastructure={venueInfrastructure || undefined}
        serviceSetups={serviceSetups}
        basePriceCents={service?.priceCents || undefined}
        serviceId={serviceId}
      />
    </div>
  );
}

