// src/pages/ServiceDiscoveryDetailPage.tsx
// Detalhe de Serviço na Descoberta
// SPRINT: Service Discovery MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getServiceForDiscovery, type DiscoveredService } from '../api/service-discovery';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import ServiceSetupSelector from '../components/compatibility/ServiceSetupSelector';
import ServiceOfferingSelector from '../components/ServiceOfferingSelector';
import CompatibilityChecklist from '../components/compatibility/CompatibilityChecklist';
import CompatibilityModal from '../components/compatibility/CompatibilityModal';
import { evaluateCompatibility } from '../api/compatibility';
import { getEvent } from '../api/events';
import type { ServiceSetupPackage, EventCapacityMetadata, VenueInfrastructureMetadata, CompatibilityResult } from '../types/compatibility';
import { getCapacityClass } from '../types/compatibility';
import './ServiceDiscoveryDetailPage.css';

export default function ServiceDiscoveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [service, setService] = useState<DiscoveredService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(searchParams.get('eventId'));
  const [eventCapacity, setEventCapacity] = useState<EventCapacityMetadata | null>(null);
  const [venueInfrastructure, setVenueInfrastructure] = useState<VenueInfrastructureMetadata | null>(null);
  const [serviceSetups, setServiceSetups] = useState<ServiceSetupPackage[]>([]);
  const [selectedSetupId, setSelectedSetupId] = useState<string>('');
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadService();
    }
  }, [id]);

  useEffect(() => {
    if (eventId) {
      loadEventData();
    }
  }, [eventId]);

  useEffect(() => {
    if (service) {
      // Extrair setups do metadata do serviço
      const setups = (service.metadata?.setups as ServiceSetupPackage[]) || [];
      setServiceSetups(setups);
      if (setups.length > 0 && !selectedSetupId) {
        setSelectedSetupId(setups[0].id);
      }
    }
  }, [service]);

  useEffect(() => {
    if (selectedSetupId && eventCapacity && venueInfrastructure && serviceSetups.length > 0) {
      evaluateCompatibilityForSetup();
    }
  }, [selectedSetupId, eventCapacity, venueInfrastructure, serviceSetups]);

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      const event = await getEvent(eventId);
      // Extrair capacidade e infraestrutura do metadata do evento
      const capacity = event.metadata?.capacity as EventCapacityMetadata | undefined;
      const infra = event.metadata?.venueInfrastructure as VenueInfrastructureMetadata | undefined;

      if (capacity) {
        setEventCapacity(capacity);
      }
      if (infra) {
        setVenueInfrastructure(infra);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar dados do evento:', err);
    }
  };

  const evaluateCompatibilityForSetup = async () => {
    if (!selectedSetupId || !eventCapacity || !venueInfrastructure) return;

    const selectedSetup = serviceSetups.find(s => s.id === selectedSetupId);
    if (!selectedSetup) return;

    try {
      const result = await evaluateCompatibility({
        eventCapacity: {
          expectedAttendance: eventCapacity.expectedAttendance,
          capacityClass: eventCapacity.capacityClass,
        },
        venueInfrastructure: {
          available: venueInfrastructure.available || [],
          unavailable: venueInfrastructure.unavailable || [],
          constraints: venueInfrastructure.constraints || [],
        },
        serviceSetup: {
          id: selectedSetup.id,
          label: selectedSetup.label,
          brings: selectedSetup.brings,
          requires: selectedSetup.requires,
          optional: selectedSetup.optional,
          minCapacityClass: selectedSetup.minCapacityClass,
          maxCapacityClass: selectedSetup.maxCapacityClass,
          priceModifier: selectedSetup.priceModifier,
        },
        basePriceCents: service?.priceCents || undefined,
      });

      setCompatibility(result);
    } catch (error: any) {
      console.error('Erro ao avaliar compatibilidade:', error);
    }
  };

  const loadService = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getServiceForDiscovery(id);
      if (!data) {
        setError('Serviço não encontrado');
      } else {
        setService(data);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar serviço');
      showToast(err.message || 'Erro ao carregar serviço', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number | null, currency: string | null): string => {
    if (!cents) return 'A consultar';
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Caminho de EVENTO (frente de eventos — fora do escopo desta polish): abre o modal de
  // compatibilidade. NÃO navega mais para /service-orders/new pela jornada de serviço:
  // a reserva canônica nasce pelo ServiceOfferingSelector (POST /service-orders direto = 403).
  const handleRequestContact = () => {
    if (eventId && eventCapacity && venueInfrastructure && serviceSetups.length > 0) {
      setShowCompatibilityModal(true);
    }
  };

  // CTA canônico: leva o cliente à seção de ofertas (reserva real), sem rota de criação direta de ordem.
  const handleScheduleCanonical = () => {
    showToast('Escolha uma oferta e um horário na seção "Ofertas disponíveis" para agendar.', 'info');
    document.getElementById('canonical-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCompatibilityConfirm = (setupId: string, compatibility: CompatibilityResult) => {
    // Se bloqueado ou requer produção assistida, não permite continuar
    if (compatibility.status === 'BLOCKED' || compatibility.requiresProductionAssistance) {
      showToast('Esta combinação não é compatível ou requer produção assistida', 'error');
      return;
    }

    // Navegar para criação de service order com setup selecionado
    if (service?.serviceId) {
      navigate(`/service-orders/new?serviceId=${service.serviceId}&setupId=${setupId}`);
    }
    setShowCompatibilityModal(false);
  };

  const handleViewAvailability = () => {
    // Navegar para página de disponibilidade
    if (service?.serviceId || id) {
      navigate(`/services/${service?.serviceId || id}/availability`);
    }
  };

  if (isLoading) {
    return (
      <div className="service-discovery-detail-page">
        <div className="loading">Carregando serviço...</div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="service-discovery-detail-page">
        <div className="error">
          <p>{error || 'Serviço não encontrado'}</p>
          <button onClick={() => navigate('/discover/services')}>Voltar para Descoberta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="service-discovery-detail-page">
      <div className="page-header">
        <button onClick={() => navigate('/discover/services')}>← Voltar</button>
        <h1>{service.name}</h1>
      </div>

      {/* Costura frontend: o dono do serviço chega à Central do prestador (hub) a partir
          da própria vitrine. Projeção — não concede autoridade (revalidada no backend). */}
      {activeActor && service.actorId === activeActor.actor_id && (
        <div className="owner-stitch">
          <span>Este serviço é seu.</span>
          <button className="stitch-link" onClick={() => navigate('/provider/services')}>
            Gerenciar na Central do prestador →
          </button>
        </div>
      )}

      <div className="service-detail-content">
        <div className="service-main">
          {/* Informações do Actor */}
          {service.actor && (
            <div className="service-section">
              <h2>Prestador</h2>
              <div className="actor-info">
                <div className="actor-name">
                  {service.actor.display_name || service.actorId}
                </div>
                <div className="actor-type">
                  Tipo: {service.actor.actor_type}
                </div>
              </div>
            </div>
          )}

          {/* Descrição */}
          {service.description && (
            <div className="service-section">
              <h2>Descrição</h2>
              <p className="service-description">{service.description}</p>
            </div>
          )}

          {/* Preço */}
          {service.priceCents && (
            <div className="service-section">
              <h2>Preço</h2>
              <div className="service-price">
                {formatCurrency(service.priceCents, service.currency)}
                {service.pricingType && (
                  <span className="pricing-type"> / {service.pricingType}</span>
                )}
              </div>
            </div>
          )}

          {/* Localização */}
          {(service.cityId || service.stateId || service.countryId) && (
            <div className="service-section">
              <h2>Localização</h2>
              <div className="service-location">
                {service.neighborhood && <span>{service.neighborhood}, </span>}
                {service.cityId && <span>{service.cityId}</span>}
                {service.stateId && <span>, {service.stateId}</span>}
                {service.countryId && <span> - {service.countryId}</span>}
              </div>
            </div>
          )}

          {/* B2 / F-OFFER: ofertas contratáveis (active-only) + jornada de reserva pré-dinheiro */}
          {service.canonicalServiceId && (
            <div id="canonical-offers">
              <ServiceOfferingSelector
                canonicalServiceId={service.canonicalServiceId}
                serviceId={service.serviceId}
              />
            </div>
          )}

          {/* Resumo de Disponibilidade */}
          {service.availability_summary && (
            <div className="service-section">
              <h2>Disponibilidade</h2>
              <div className="availability-summary">
                <div className="availability-status">
                  {service.availability_summary.has_availability ? (
                    <span className="availability-badge">Agenda aberta</span>
                  ) : (
                    <span className="availability-badge unavailable">Sem disponibilidade</span>
                  )}
                </div>
                {service.availability_summary.next_available_date && (
                  <div className="next-availability">
                    Próxima disponibilidade: {formatDateTime(service.availability_summary.next_available_date)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Setups do Serviço */}
          {serviceSetups.length > 0 && (
            <div className="service-section">
              <h2>Setups Disponíveis</h2>
              <ServiceSetupSelector
                setups={serviceSetups}
                selectedSetupId={selectedSetupId}
                onSelect={setSelectedSetupId}
              />
            </div>
          )}

          {/* Compatibilidade com Evento (se contexto existe) */}
          {eventId && eventCapacity && venueInfrastructure && compatibility && (
            <div className="service-section">
              <h2>Compatibilidade com Evento</h2>
              <CompatibilityChecklist result={compatibility} showPricing={true} />
            </div>
          )}

          {/* Ações */}
          <div className="service-actions">
            <button onClick={handleViewAvailability} className="btn-primary">
              Ver Disponibilidade Completa
            </button>
            {/* CTA legado "Solicitar Contato" CONTIDO: na jornada de serviço o agendamento é
                pela seção de ofertas (reserva canônica). O caminho de evento (compatibilidade)
                permanece como feature própria, fora desta polish. */}
            {eventId && eventCapacity && venueInfrastructure && serviceSetups.length > 0 ? (
              <button onClick={handleRequestContact} className="btn-secondary">
                Verificar Compatibilidade e Solicitar
              </button>
            ) : service.canonicalServiceId ? (
              <button onClick={handleScheduleCanonical} className="btn-secondary">
                Agendar pelo fluxo de reserva
              </button>
            ) : (
              <button
                className="btn-secondary"
                disabled
                title="Agendamento online indisponível para este serviço no momento."
              >
                Agendamento indisponível
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Compatibilidade */}
      {showCompatibilityModal && eventCapacity && venueInfrastructure && (
        <CompatibilityModal
          isOpen={showCompatibilityModal}
          onClose={() => setShowCompatibilityModal(false)}
          onConfirm={handleCompatibilityConfirm}
          eventCapacity={eventCapacity}
          venueInfrastructure={venueInfrastructure}
          serviceSetups={serviceSetups}
          basePriceCents={service?.priceCents || undefined}
          serviceId={service?.serviceId || ''}
        />
      )}
    </div>
  );
}

