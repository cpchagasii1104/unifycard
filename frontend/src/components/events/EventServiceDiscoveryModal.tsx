// src/components/events/EventServiceDiscoveryModal.tsx
// Modal de Descoberta de Serviços Contextual para Eventos
// SPRINT: Integração Eventos → Service Discovery

import { useState, useEffect } from 'react';
import { discoverServices, type DiscoveredService, type ServiceDiscoveryFilters } from '../../api/service-discovery';
import { showToast } from '../common/Toast';
import './EventServiceDiscoveryModal.css';

export interface SelectedService {
  serviceId: string;
  actorId: string;
  serviceName: string;
  actorName: string | null;
  addedAt: string; // ISO 8601
}

export interface EventServiceDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (service: SelectedService) => void;
  eventContext?: {
    categoryId?: string | null;
    cityId?: string | null;
    stateId?: string | null;
    startDate?: string; // ISO 8601
    endDate?: string; // ISO 8601
  };
  selectedServices?: SelectedService[]; // Serviços já selecionados (para evitar duplicatas)
}

export default function EventServiceDiscoveryModal({
  isOpen,
  onClose,
  onSelect,
  eventContext,
  selectedServices = [],
}: EventServiceDiscoveryModalProps) {
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros (pré-preenchidos com contexto do evento)
  const [categoryId, setCategoryId] = useState<string>(eventContext?.categoryId || '');
  const [cityId, setCityId] = useState<string>(eventContext?.cityId || '');
  const [stateId, setStateId] = useState<string>(eventContext?.stateId || '');
  const [startDate, setStartDate] = useState<string>(eventContext?.startDate || '');
  const [endDate, setEndDate] = useState<string>(eventContext?.endDate || '');
  const [hasAvailability, setHasAvailability] = useState<boolean>(false);
  const [actorType, setActorType] = useState<string>('');

  // Paginação
  const [limit] = useState<number>(20);
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      // Pré-preencher filtros com contexto do evento
      if (eventContext) {
        setCategoryId(eventContext.categoryId || '');
        setCityId(eventContext.cityId || '');
        setStateId(eventContext.stateId || '');
        setStartDate(eventContext.startDate || '');
        setEndDate(eventContext.endDate || '');
      }
      loadServices();
    }
  }, [isOpen, categoryId, cityId, stateId, startDate, endDate, hasAvailability, actorType, offset]);

  const loadServices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: ServiceDiscoveryFilters = {
        category_id: categoryId || undefined,
        city_id: cityId || undefined,
        state_id: stateId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        has_availability: hasAvailability || undefined,
        actor_type: actorType ? (actorType as 'user' | 'page' | 'group' | 'channel') : undefined,
        limit,
        offset,
      };

      const data = await discoverServices(filters);
      setServices(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar serviços');
      showToast(err.message || 'Erro ao buscar serviços', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (service: DiscoveredService) => {
    // Verificar se já está selecionado
    const isAlreadySelected = selectedServices.some(
      s => s.serviceId === service.serviceId
    );

    if (isAlreadySelected) {
      showToast('Este serviço já foi selecionado', 'info');
      return;
    }

    const selected: SelectedService = {
      serviceId: service.serviceId,
      actorId: service.actorId,
      serviceName: service.name,
      actorName: service.actor?.display_name || null,
      addedAt: new Date().toISOString(),
    };

    onSelect(selected);
    showToast('Serviço selecionado para o evento', 'success');
  };

  const formatCurrency = (cents: number | null, currency: string | null): string => {
    if (!cents) return 'A consultar';
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="event-service-discovery-modal-overlay" onClick={onClose}>
      <div className="event-service-discovery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Buscar Artistas / Serviços</h2>
          <button onClick={onClose} className="modal-close-btn">×</button>
        </div>

        <div className="modal-content">
          {/* Contexto do Evento */}
          {eventContext && (
            <div className="event-context-banner">
              <p>
                <strong>Filtros pré-preenchidos com o contexto do evento:</strong>
                {eventContext.categoryId && ' Categoria •'}
                {eventContext.cityId && ' Cidade •'}
                {eventContext.startDate && ' Data'}
              </p>
            </div>
          )}

          {/* Filtros */}
          <div className="modal-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="modal-category">Categoria:</label>
                <input
                  id="modal-category"
                  type="text"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="ID da categoria"
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="modal-city">Cidade:</label>
                <input
                  id="modal-city"
                  type="text"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  placeholder="ID da cidade"
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="modal-state">Estado:</label>
                <input
                  id="modal-state"
                  type="text"
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                  placeholder="ID do estado"
                  className="filter-input"
                />
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="modal-start-date">Data Início:</label>
                <input
                  id="modal-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="modal-end-date">Data Fim:</label>
                <input
                  id="modal-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="modal-actor-type">Tipo:</label>
                <select
                  id="modal-actor-type"
                  value={actorType}
                  onChange={(e) => setActorType(e.target.value)}
                  className="filter-input"
                >
                  <option value="">Todos</option>
                  <option value="user">Usuário</option>
                  <option value="page">Página</option>
                  <option value="group">Grupo</option>
                  <option value="channel">Canal</option>
                </select>
              </div>
            </div>

            <div className="filter-row">
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={hasAvailability}
                  onChange={(e) => setHasAvailability(e.target.checked)}
                />
                <span>Agenda aberta</span>
              </label>
            </div>
          </div>

          {/* Lista de Serviços */}
          <div className="modal-services-list">
            {isLoading ? (
              <div className="loading">Carregando serviços...</div>
            ) : error ? (
              <div className="error">
                <p>{error}</p>
                <button onClick={loadServices}>Tentar novamente</button>
              </div>
            ) : services.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum serviço encontrado.</p>
                <p className="empty-hint">Tente ajustar os filtros.</p>
              </div>
            ) : (
              <>
                <div className="services-grid">
                  {services.map((service) => {
                    const isSelected = selectedServices.some(
                      s => s.serviceId === service.serviceId
                    );

                    return (
                      <div
                        key={service.serviceId}
                        className={`service-card ${isSelected ? 'service-card-selected' : ''}`}
                      >
                        <div className="service-card-header">
                          <h3 className="service-name">{service.name}</h3>
                          {service.availability_summary?.has_availability && (
                            <span className="availability-badge">Agenda aberta</span>
                          )}
                        </div>
                        {service.actor && (
                          <div className="service-actor">
                            Por: {service.actor.display_name || service.actorId}
                          </div>
                        )}
                        {service.shortDescription && (
                          <p className="service-description">{service.shortDescription}</p>
                        )}
                        {service.priceCents && (
                          <div className="service-price">
                            {formatCurrency(service.priceCents, service.currency)}
                          </div>
                        )}
                        <button
                          onClick={() => handleSelectService(service)}
                          disabled={isSelected}
                          className={`btn-select-service ${isSelected ? 'btn-selected' : ''}`}
                        >
                          {isSelected ? '✓ Já selecionado' : 'Selecionar para este Evento'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Paginação */}
                <div className="pagination">
                  <button
                    onClick={() => setOffset(prev => Math.max(0, prev - limit))}
                    disabled={offset === 0}
                    className="btn-pagination"
                  >
                    Anterior
                  </button>
                  <span className="pagination-info">
                    Página {Math.floor(offset / limit) + 1}
                  </span>
                  <button
                    onClick={() => setOffset(prev => prev + limit)}
                    disabled={services.length < limit}
                    className="btn-pagination"
                  >
                    Próxima
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




