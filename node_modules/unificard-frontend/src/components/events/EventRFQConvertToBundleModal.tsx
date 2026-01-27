// frontend/src/components/events/EventRFQConvertToBundleModal.tsx
// Modal para converter múltiplas propostas RFQ em Service Bundle
// 🔴 BLINDAGEM: NÃO converte automaticamente
// 🔴 BLINDAGEM: NÃO cria pagamento
// 🔴 BLINDAGEM: NÃO cria split

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { createBundleBookings, BundleDependencyType, type CreateBundleBookingInput } from '../../api/service-bundles';
import { listServiceAvailabilities, type ServiceAvailability } from '../../api/service-availability';
import { getRFQById, type EventRFQ } from '../../api/event-rfq';
import { getService } from '../../api/services';
import { showToast } from '../common/Toast';
import type { QuoteResponse } from '../../api/event-rfq';
import './EventRFQConvertToBundleModal.css';

interface EventRFQConvertToBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bundleId: string, bookingIds: string[]) => void;
  eventId: string;
  rfqId: string;
  quotes: QuoteResponse[];
}

export default function EventRFQConvertToBundleModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  rfqId,
  quotes,
}: EventRFQConvertToBundleModalProps) {
  const { activeActor } = useActiveActor();
  const [rfq, setRFQ] = useState<EventRFQ | null>(null);
  const [services, setServices] = useState<Record<string, any>>({});
  const [availabilities, setAvailabilities] = useState<Record<string, ServiceAvailability[]>>({});
  const [selectedAvailabilities, setSelectedAvailabilities] = useState<Record<string, string>>({});
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState<number | null>(null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [dependencyType, setDependencyType] = useState<BundleDependencyType>(BundleDependencyType.SAME_TIME);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && quotes.length >= 2) {
      loadData();
    }
  }, [isOpen, quotes]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carregar RFQ para pegar critérios
      const rfqData = await getRFQById(eventId, rfqId);
      setRFQ(rfqData);

      // Carregar serviços e disponibilidades
      const servicesData: Record<string, any> = {};
      const availabilitiesData: Record<string, ServiceAvailability[]> = {};

      for (const quote of quotes) {
        const serviceData = await getService(quote.serviceId);
        servicesData[quote.serviceId] = serviceData;

        const availabilitiesList = await listServiceAvailabilities(quote.serviceId);
        availabilitiesData[quote.serviceId] = availabilitiesList;
      }

      setServices(servicesData);
      setAvailabilities(availabilitiesData);

      // Pré-preencher com dados do RFQ
      if (rfqData.criteria.date) {
        const eventDate = new Date(rfqData.criteria.date);
        setScheduledStart(eventDate.toISOString());
        // Assumir duração de 4 horas se não especificado
        const endDate = new Date(eventDate);
        endDate.setHours(endDate.getHours() + 4);
        setScheduledEnd(endDate.toISOString());
      }

      if (rfqData.criteria.location) {
        setLocationAddress(rfqData.criteria.location);
      }

      if (rfqData.criteria.locationLatitude) {
        setLocationLatitude(rfqData.criteria.locationLatitude);
      }

      if (rfqData.criteria.locationLongitude) {
        setLocationLongitude(rfqData.criteria.locationLongitude);
      }

      // Pré-preencher notas
      const quotesNotes = quotes.map(q => q.notes).filter(Boolean).join('; ');
      if (quotesNotes) {
        setNotes(`Propostas RFQ: ${quotesNotes}`);
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
      showToast('Nenhum ator ativo para criar bundle booking.', 'error');
      return;
    }

    // Validar que todas as disponibilidades foram selecionadas
    const missingAvailabilities = quotes.filter(q => !selectedAvailabilities[q.serviceId]);
    if (missingAvailabilities.length > 0) {
      setError('Selecione disponibilidade para todos os serviços');
      return;
    }

    if (!scheduledStart || !scheduledEnd) {
      setError('Defina horário de início e fim');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateBundleBookingInput = {
        serviceIds: quotes.map(q => q.serviceId),
        availabilityIds: quotes.map(q => selectedAvailabilities[q.serviceId]),
        requesterActorId: activeActor.actor_id,
        scheduledStart,
        scheduledEnd,
        locationAddress: locationAddress || null,
        locationLatitude: locationLatitude || null,
        locationLongitude: locationLongitude || null,
        notes: notes || null,
        dependencyType,
        metadata: {
          origin: 'rfq_conversion',
          rfqId,
          quoteIds: quotes.map(q => q.quoteId),
          eventId,
          proposedPrices: quotes.map(q => ({
            serviceId: q.serviceId,
            priceCents: q.priceCents,
            currency: q.currency,
          })),
        },
      };

      const result = await createBundleBookings(input);

      showToast('Bundle bookings criados com sucesso!', 'success');
      onSuccess(result.bundleId, result.bookings.map(b => b.bookingId));
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar bundle bookings');
      showToast(err.message || 'Erro ao criar bundle bookings', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="event-rfq-convert-bundle-modal-overlay" onClick={onClose}>
      <div className="event-rfq-convert-bundle-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Converter Propostas em Bundle</h2>
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
                  Esta ação criará bookings para {quotes.length} serviço(s) como um bundle.
                  Os bookings serão criados de forma atômica: todos ou nenhum.
                  Nenhum pagamento ou split será criado automaticamente.
                </p>
              </div>

              <div className="quotes-summary">
                <h3>Propostas Selecionadas ({quotes.length})</h3>
                {quotes.map((quote) => (
                  <div key={quote.quoteId} className="quote-summary-item">
                    <strong>{services[quote.serviceId]?.name || quote.serviceId}</strong>
                    <span>{formatPrice(quote.priceCents, quote.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="form-section">
                <h3>Configuração do Bundle</h3>

                {quotes.map((quote) => (
                  <div key={quote.serviceId} className="service-availability-selector">
                    <h4>{services[quote.serviceId]?.name || quote.serviceId}</h4>
                    <div className="form-group">
                      <label>Disponibilidade *</label>
                      {availabilities[quote.serviceId]?.length === 0 ? (
                        <div className="no-availabilities">
                          <p>Nenhuma disponibilidade encontrada para este serviço.</p>
                        </div>
                      ) : (
                        <select
                          value={selectedAvailabilities[quote.serviceId] || ''}
                          onChange={(e) =>
                            setSelectedAvailabilities({
                              ...selectedAvailabilities,
                              [quote.serviceId]: e.target.value,
                            })
                          }
                        >
                          <option value="">Selecione uma disponibilidade...</option>
                          {availabilities[quote.serviceId]?.map((avail) => (
                            <option key={avail.id} value={avail.id}>
                              {new Date(avail.startDatetime).toLocaleString('pt-BR')} -{' '}
                              {new Date(avail.endDatetime).toLocaleString('pt-BR')}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}

                <div className="form-group">
                  <label>Tipo de Dependência:</label>
                  <select
                    value={dependencyType}
                    onChange={(e) => setDependencyType(e.target.value as BundleDependencyType)}
                  >
                    <option value={BundleDependencyType.SAME_TIME}>Mesmo Horário</option>
                    <option value={BundleDependencyType.SAME_LOCATION}>Mesma Localização</option>
                    <option value={BundleDependencyType.PRIMARY_SECONDARY}>Primário + Secundários</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Horário de Início *</label>
                  <input
                    type="datetime-local"
                    value={scheduledStart ? new Date(scheduledStart).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setScheduledStart(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  />
                </div>

                <div className="form-group">
                  <label>Horário de Fim *</label>
                  <input
                    type="datetime-local"
                    value={scheduledEnd ? new Date(scheduledEnd).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setScheduledEnd(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  />
                </div>

                {dependencyType === BundleDependencyType.SAME_LOCATION && (
                  <>
                    <div className="form-group">
                      <label>Endereço:</label>
                      <input
                        type="text"
                        value={locationAddress}
                        onChange={(e) => setLocationAddress(e.target.value)}
                        placeholder="Endereço completo"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Latitude:</label>
                        <input
                          type="number"
                          step="any"
                          value={locationLatitude || ''}
                          onChange={(e) =>
                            setLocationLatitude(e.target.value ? parseFloat(e.target.value) : null)
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Longitude:</label>
                        <input
                          type="number"
                          step="any"
                          value={locationLongitude || ''}
                          onChange={(e) =>
                            setLocationLongitude(e.target.value ? parseFloat(e.target.value) : null)
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Observações adicionais sobre o bundle..."
                  />
                </div>
              </div>

              <div className="traceability-info">
                <h4>Rastreabilidade</h4>
                <p>Este bundle será vinculado ao RFQ e às propostas:</p>
                <ul>
                  <li>RFQ: {rfqId.substring(0, 8)}...</li>
                  <li>Propostas: {quotes.map(q => q.quoteId.substring(0, 8)).join(', ')}...</li>
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
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !scheduledStart ||
              !scheduledEnd ||
              quotes.some(q => !selectedAvailabilities[q.serviceId] || availabilities[q.serviceId]?.length === 0)
            }
          >
            {isSubmitting ? 'Criando...' : 'Criar Bundle Bookings'}
          </button>
        </div>
      </div>
    </div>
  );
}




