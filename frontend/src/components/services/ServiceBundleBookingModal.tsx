// frontend/src/components/services/ServiceBundleBookingModal.tsx
// Modal para criar bundle bookings (co-agendamento)

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getService } from '../../api/services';
import { listServiceAvailabilities } from '../../api/service-availability';
import { getEvent } from '../../api/events';
import { createBundleBookings, type CreateBundleBookingInput, BundleDependencyType } from '../../api/service-bundles';
import { showToast } from '../common/Toast';
import CompatibilityModal from '../compatibility/CompatibilityModal';
import type { Service } from '../../api/services';
import type { ServiceAvailability } from '../../api/service-availability';
import type { CompatibilityResult, EventCapacityMetadata, VenueInfrastructureMetadata, ServiceSetupPackage } from '../../types/compatibility';
import { useAgreementValidation } from '../../hooks/useAgreementValidation';
import BlockedButton from '../common/BlockedButton';
import AgreementSummary from '../agreements/AgreementSummary';
import '../agreements/AgreementSection.css';
import './ServiceBundleBookingModal.css';

interface ServiceBundleBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bundleId: string, bookingIds: string[]) => void;
  serviceIds: string[]; // Serviços a agendar
  eventId?: string; // Opcional: ID do evento para validação de compatibilidade
}

export default function ServiceBundleBookingModal({
  isOpen,
  onClose,
  onSuccess,
  serviceIds,
  eventId,
}: ServiceBundleBookingModalProps) {
  const { activeActor } = useActiveActor();
  const [services, setServices] = useState<Service[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, ServiceAvailability[]>>({});
  const [selectedAvailabilities, setSelectedAvailabilities] = useState<Record<string, string>>({});
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState<number | null>(null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [dependencyType, setDependencyType] = useState<BundleDependencyType>(BundleDependencyType.SAME_TIME);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);
  const [eventCapacity, setEventCapacity] = useState<EventCapacityMetadata | null>(null);
  const [venueInfrastructure, setVenueInfrastructure] = useState<VenueInfrastructureMetadata | null>(null);
  const [firstServiceSetups, setFirstServiceSetups] = useState<ServiceSetupPackage[]>([]);

  // 🔴 BLINDAGEM: Validar acordo antes de permitir criação de bundle
  const agreementValidation = useAgreementValidation(
    eventId ? 'event' : 'bundle',
    eventId || 'new',
    !!eventId // Só requer acordo se houver eventId
  );

  useEffect(() => {
    if (isOpen && serviceIds.length >= 2) {
      loadServices();
    }
  }, [isOpen, serviceIds]);

  const loadServices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carregar serviços
      const servicesData = await Promise.all(
        serviceIds.map(serviceId => getService(serviceId))
      );
      setServices(servicesData);

      // Carregar disponibilidades de cada serviço
      const availabilitiesData: Record<string, ServiceAvailability[]> = {};
      for (const service of servicesData) {
        const avails = await listServiceAvailabilities(service.id);
        availabilitiesData[service.id] = avails;
      }
      setAvailabilities(availabilitiesData);

      // Se houver eventId, carregar dados do evento e setups do primeiro serviço para compatibilidade
      if (eventId && servicesData.length > 0) {
        try {
          const eventData = await getEvent(eventId);
          const capacity = (eventData as any).metadata?.capacity as EventCapacityMetadata | undefined;
          const venueInfra = (eventData as any).metadata?.venueInfrastructure as VenueInfrastructureMetadata | undefined;
          
          if (capacity) {
            setEventCapacity(capacity);
          }
          if (venueInfra) {
            setVenueInfrastructure(venueInfra);
          }

          // Extrair setups do primeiro serviço (representativo para o bundle)
          const firstService = servicesData[0];
          const setups = (firstService.metadata?.setups as any)?.setups || [];
          setFirstServiceSetups(setups);
        } catch (err) {
          console.warn('Erro ao carregar dados do evento para compatibilidade (não crítico):', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar serviços');
      showToast(err.message || 'Erro ao carregar serviços', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeActor) {
      showToast('Nenhum ator ativo para criar bundle booking.', 'error');
      return;
    }

    // Validações
    if (serviceIds.length < 2) {
      showToast('Bundle deve conter pelo menos 2 serviços', 'error');
      return;
    }

    const missingAvailabilities = serviceIds.filter(id => !selectedAvailabilities[id]);
    if (missingAvailabilities.length > 0) {
      showToast('Selecione disponibilidade para todos os serviços', 'error');
      return;
    }

    if (!scheduledStart || !scheduledEnd) {
      showToast('Defina horário de início e fim', 'error');
      return;
    }

    if (dependencyType === BundleDependencyType.SAME_LOCATION && !locationAddress) {
      showToast('Defina localização para bundle com dependência de localização', 'error');
      return;
    }

    // Se houver dados de compatibilidade, mostrar modal antes de enviar
    if (eventId && eventCapacity && venueInfrastructure && firstServiceSetups.length > 0 && services.length > 0) {
      setIsCompatibilityModalOpen(true);
      return;
    }

    // Se não houver dados de compatibilidade, prosseguir diretamente
    await submitBundle();
  };

  const submitBundle = async () => {
    if (!activeActor) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateBundleBookingInput = {
        serviceIds,
        availabilityIds: serviceIds.map(id => selectedAvailabilities[id]),
        requesterActorId: activeActor.actor_id,
        scheduledStart,
        scheduledEnd,
        locationAddress: locationAddress || null,
        locationLatitude: locationLatitude || null,
        locationLongitude: locationLongitude || null,
        notes: notes || null,
        dependencyType,
        metadata: eventId ? { eventId } : undefined,
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

  const handleCompatibilityConfirm = async (setupId: string, compatibility: CompatibilityResult) => {
    setIsCompatibilityModalOpen(false);

    // Se estiver BLOCKED ou requerer produção assistida, não prosseguir
    if (compatibility.status === 'BLOCKED' || compatibility.requiresProductionAssistance) {
      showToast('Não é possível criar bundle devido a incompatibilidade técnica ou requisito de produção assistida.', 'error');
      return;
    }

    // Se for WARNING, já foi confirmado pelo usuário no modal
    // Prosseguir com o bundle
    await submitBundle();
  };

  if (!isOpen) return null;

  return (
    <div className="service-bundle-booking-modal-overlay" onClick={onClose}>
      <div className="service-bundle-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Criar Bundle de Serviços</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="loading">Carregando serviços...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <>
              <div className="bundle-info">
                <p className="bundle-warning">
                  ⚠️ <strong>Atenção:</strong> Todos os serviços serão agendados juntos.
                  A confirmação será atômica: todos aceitam ou nenhum confirma.
                </p>
              </div>

              <div className="form-section">
                <h3>Serviços do Bundle</h3>
                <div className="services-list">
                  {services.map((service) => (
                    <div key={service.id} className="service-item">
                      <div className="service-info">
                        <h4>{service.name}</h4>
                        <p>{service.description || 'Sem descrição'}</p>
                      </div>
                      <div className="availability-selector">
                        <label>Disponibilidade:</label>
                        <select
                          value={selectedAvailabilities[service.id] || ''}
                          onChange={(e) =>
                            setSelectedAvailabilities({
                              ...selectedAvailabilities,
                              [service.id]: e.target.value,
                            })
                          }
                        >
                          <option value="">Selecione...</option>
                          {(availabilities[service.id] || []).map((avail) => (
                            <option key={avail.id} value={avail.id}>
                              {new Date(avail.startDatetime).toLocaleString('pt-BR')} -{' '}
                              {new Date(avail.endDatetime).toLocaleString('pt-BR')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h3>Configuração do Bundle</h3>
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
                  <label>Horário de Início:</label>
                  <input
                    type="datetime-local"
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Horário de Fim:</label>
                  <input
                    type="datetime-local"
                    value={scheduledEnd}
                    onChange={(e) => setScheduledEnd(e.target.value)}
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
                  <label>Notas (opcional):</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Observações sobre o bundle..."
                  />
                </div>
              </div>

              {/* 🔴 BLINDAGEM: Seção de Acordo (apenas se houver eventId) */}
              {eventId && !agreementValidation.isLoading && (
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
                          ℹ️ Este acordo é registrado e utilizado em caso de disputa. O valor do bundle será baseado neste acordo.
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
                      <p>Este bundle exige acordo fechado na plataforma. Crie um acordo antes de criar o bundle.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          {agreementValidation.canProceed || !eventId ? (
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Criando...' : 'Criar Bundle Bookings'}
            </button>
          ) : (
            <BlockedButton
              reason={agreementValidation.blockingReason || 'Acordo não finalizado'}
              className="btn-primary"
            >
              Criar Bundle Bookings
            </BlockedButton>
          )}
        </div>
      </div>

      {/* Modal de Compatibilidade (apenas se eventId for fornecido) */}
      {eventId && services.length > 0 && (
        <CompatibilityModal
          isOpen={isCompatibilityModalOpen}
          onClose={() => setIsCompatibilityModalOpen(false)}
          onConfirm={handleCompatibilityConfirm}
          eventCapacity={eventCapacity || undefined}
          venueInfrastructure={venueInfrastructure || undefined}
          serviceSetups={firstServiceSetups}
          basePriceCents={services[0]?.priceCents || undefined}
          serviceId={services[0]?.id || ''}
        />
      )}
    </div>
  );
}

