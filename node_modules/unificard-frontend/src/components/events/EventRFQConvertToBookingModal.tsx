// frontend/src/components/events/EventRFQConvertToBookingModal.tsx
// Modal para converter proposta RFQ em Booking
// 🔴 BLINDAGEM: NÃO converte automaticamente
// 🔴 BLINDAGEM: NÃO cria pagamento
// 🔴 BLINDAGEM: NÃO cria split

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { createServiceBooking, type CreateBookingInput } from '../../api/service-bookings';
import { listServiceAvailabilities, type ServiceAvailability } from '../../api/service-availability';
import { getRFQById, type EventRFQ } from '../../api/event-rfq';
import { getService } from '../../api/services';
import { getEvent } from '../../api/events';
import { showToast } from '../../utils/toast';
import CompatibilityModal from '../compatibility/CompatibilityModal';
import type { QuoteResponse } from '../../api/event-rfq';
import type { CompatibilityResult, EventCapacityMetadata, VenueInfrastructureMetadata, ServiceSetupPackage } from '../../types/compatibility';
import { useAgreementValidation } from '../../hooks/useAgreementValidation';
import BlockedButton from '../common/BlockedButton';
import AgreementSummary from '../agreements/AgreementSummary';
import '../agreements/AgreementSection.css';
import './EventRFQConvertToBookingModal.css';

interface EventRFQConvertToBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
  eventId: string;
  rfqId: string;
  quote: QuoteResponse;
}

export default function EventRFQConvertToBookingModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  rfqId,
  quote,
}: EventRFQConvertToBookingModalProps) {
  const { activeActor } = useActiveActor();
  const [rfq, setRFQ] = useState<EventRFQ | null>(null);
  const [service, setService] = useState<any>(null);
  const [availabilities, setAvailabilities] = useState<ServiceAvailability[]>([]);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);
  const [eventCapacity, setEventCapacity] = useState<EventCapacityMetadata | null>(null);
  const [venueInfrastructure, setVenueInfrastructure] = useState<VenueInfrastructureMetadata | null>(null);
  const [serviceSetups, setServiceSetups] = useState<ServiceSetupPackage[]>([]);

  // 🔴 BLINDAGEM: Validar acordo antes de permitir conversão RFQ → Booking
  const agreementValidation = useAgreementValidation('event', eventId, true);

  useEffect(() => {
    if (isOpen && quote) {
      loadData();
    }
  }, [isOpen, quote]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carregar RFQ para pegar critérios
      const rfqData = await getRFQById(eventId, rfqId);
      setRFQ(rfqData);

      // Carregar evento para obter capacidade e infraestrutura
      const eventData = await getEvent(eventId);

      // Extrair capacidade e infraestrutura do evento
      const capacity = (eventData as any).metadata?.capacity as EventCapacityMetadata | undefined;
      const venueInfra = (eventData as any).metadata?.venueInfrastructure as VenueInfrastructureMetadata | undefined;
      
      if (capacity) {
        setEventCapacity(capacity);
      }
      if (venueInfra) {
        setVenueInfrastructure(venueInfra);
      }

      // Carregar serviço
      const serviceData = await getService(quote.serviceId);
      setService(serviceData);

      // Extrair setups do serviço
      const setups = (serviceData.metadata?.setups as any)?.setups || [];
      setServiceSetups(setups);

      // Carregar disponibilidades do serviço
      const availabilitiesData = await listServiceAvailabilities(quote.serviceId);
      setAvailabilities(availabilitiesData);

      // Pré-selecionar disponibilidade se RFQ tem data
      if (rfqData.criteria.date && availabilitiesData.length > 0) {
        const eventDate = new Date(rfqData.criteria.date);
        const matchingAvailability = availabilitiesData.find((avail) => {
          const availStart = new Date(avail.startDatetime);
          const availEnd = new Date(avail.endDatetime);
          return eventDate >= availStart && eventDate <= availEnd;
        });
        if (matchingAvailability) {
          setSelectedAvailabilityId(matchingAvailability.id);
        }
      }

      // Pré-preencher notas com observações da proposta
      if (quote.notes) {
        setNotes(`Proposta RFQ: ${quote.notes}`);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
      showToast(err.message || 'Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeActor) {
      showToast('Nenhum ator ativo para criar booking.', 'error');
      return;
    }

    if (!selectedAvailabilityId) {
      setError('Selecione uma disponibilidade');
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
    if (!activeActor || !selectedAvailabilityId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateBookingInput = {
        serviceId: quote.serviceId,
        availabilityId: selectedAvailabilityId,
        requesterActorId: activeActor.actor_id,
        notes: notes || null,
        metadata: {
          origin: 'rfq_conversion',
          rfqId,
          quoteId: quote.quoteId,
          eventId,
          proposedPriceCents: quote.priceCents,
          proposedCurrency: quote.currency,
        },
      };

      const booking = await createServiceBooking(quote.serviceId, input);

      showToast('Booking criado com sucesso!', 'success');
      onSuccess(booking.bookingId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar booking');
      showToast(err.message || 'Erro ao criar booking', 'error');
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

  if (!isOpen) return null;

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  return (
    <div className="event-rfq-convert-booking-modal-overlay" onClick={onClose}>
      <div className="event-rfq-convert-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Converter Proposta em Booking</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="loading">Carregando dados...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <>
              <div className="conversion-warning">
                <strong>⚠️ Atenção:</strong>
                <p>
                  Esta ação criará um booking para o serviço. O booking será um PEDIDO,
                  não uma confirmação. Nenhum pagamento ou split será criado automaticamente.
                </p>
              </div>

              <div className="quote-summary">
                <h3>Proposta Selecionada</h3>
                <div className="summary-item">
                  <strong>Serviço:</strong> {service?.name || quote.serviceId}
                </div>
                <div className="summary-item">
                  <strong>Valor Proposto:</strong> {formatPrice(quote.priceCents, quote.currency)}
                </div>
                {quote.notes && (
                  <div className="summary-item">
                    <strong>Observações:</strong> {quote.notes}
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Configuração do Booking</h3>

                <div className="form-group">
                  <label>Disponibilidade *</label>
                  {availabilities.length === 0 ? (
                    <div className="no-availabilities">
                      <p>Nenhuma disponibilidade encontrada para este serviço.</p>
                      <p className="help-text">É necessário criar uma disponibilidade antes de criar o booking.</p>
                    </div>
                  ) : (
                    <select
                      value={selectedAvailabilityId}
                      onChange={(e) => setSelectedAvailabilityId(e.target.value)}
                    >
                      <option value="">Selecione uma disponibilidade...</option>
                      {availabilities.map((avail) => (
                        <option key={avail.id} value={avail.id}>
                          {new Date(avail.startDatetime).toLocaleString('pt-BR')} -{' '}
                          {new Date(avail.endDatetime).toLocaleString('pt-BR')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Observações adicionais sobre o booking..."
                  />
                </div>
              </div>

              {/* 🔴 BLINDAGEM: Seção de Acordo */}
              {!agreementValidation.isLoading && (
                <div className="form-section agreement-section">
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
                      {agreementValidation.agreement.priceCents !== quote.priceCents && (
                        <div className="agreement-price-warning">
                          <strong>⚠️ Atenção:</strong> O valor do acordo ({formatPrice(agreementValidation.agreement.priceCents, agreementValidation.agreement.currency)}) difere do valor proposto ({formatPrice(quote.priceCents, quote.currency)}). O valor do acordo será usado.
                        </div>
                      )}
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
                      <p>Este serviço exige acordo fechado na plataforma. Crie um acordo antes de converter a proposta em booking.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="traceability-info">
                <h4>Rastreabilidade</h4>
                <p>Este booking será vinculado ao RFQ e à proposta:</p>
                <ul>
                  <li>RFQ: {rfqId.substring(0, 8)}...</li>
                  <li>Proposta: {quote.quoteId.substring(0, 8)}...</li>
                  <li>Evento: {eventId.substring(0, 8)}...</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          {agreementValidation.canProceed ? (
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedAvailabilityId || availabilities.length === 0}
            >
              {isSubmitting ? 'Criando...' : 'Criar Booking'}
            </button>
          ) : (
            <BlockedButton
              reason={agreementValidation.blockingReason || 'Acordo não finalizado'}
              className="btn-primary"
            >
              Criar Booking
            </BlockedButton>
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
        serviceId={quote.serviceId}
      />
    </div>
  );
}

