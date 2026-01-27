// src/pages/ServiceDiscoveryPage.tsx
// Página de Descoberta de Serviços
// SPRINT: Service Discovery MVP
// Conectado ao endpoint backend canônico GET /services/discover

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { discoverServices, type DiscoveredService, type ServiceDiscoveryFilters } from '../api/service-discovery';
import { showToast } from '../components/common/Toast';
import './ServiceDiscoveryPage.css';

export default function ServiceDiscoveryPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  
  // Filtros
  const [categoryId, setCategoryId] = useState<string>('');
  const [cityId, setCityId] = useState<string>('');
  const [stateId, setStateId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hasAvailability, setHasAvailability] = useState<boolean>(false);
  const [actorType, setActorType] = useState<string>('');
  
  // Paginação
  const [limit] = useState<number>(20);
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    loadServices();
  }, [categoryId, cityId, stateId, startDate, endDate, hasAvailability, actorType, offset]);

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
      setTotalCount(data.length);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar serviços');
      showToast(err.message || 'Erro ao buscar serviços', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setCategoryId('');
    setCityId('');
    setStateId('');
    setStartDate('');
    setEndDate('');
    setHasAvailability(false);
    setActorType('');
    setOffset(0);
  };

  const handleNextPage = () => {
    setOffset(prev => prev + limit);
  };

  const handlePrevPage = () => {
    setOffset(prev => Math.max(0, prev - limit));
  };

  const formatCurrency = (cents: number | null, currency: string | null): string => {
    if (!cents) return 'A consultar';
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  return (
    <div className="service-discovery-page">
      <div className="page-header">
        <h1>Descobrir Serviços</h1>
        <p className="page-subtitle">Encontre artistas, bandas e profissionais</p>
      </div>

      <div className="discovery-layout">
        {/* Filtros Laterais */}
        <div className="filters-sidebar">
          <h2>Filtros</h2>

          <div className="filter-section">
            <label htmlFor="category">Categoria:</label>
            <input
              id="category"
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="ID da categoria"
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="city">Cidade:</label>
            <input
              id="city"
              type="text"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              placeholder="ID da cidade"
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="state">Estado:</label>
            <input
              id="state"
              type="text"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              placeholder="ID do estado"
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="start-date">Data Início (opcional):</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="end-date">Data Fim (opcional):</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="actor-type">Tipo de Actor:</label>
            <select
              id="actor-type"
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

          <div className="filter-section">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={hasAvailability}
                onChange={(e) => setHasAvailability(e.target.checked)}
              />
              <span>Agenda aberta (sem data específica)</span>
            </label>
          </div>

          <div className="filter-actions">
            <button onClick={clearFilters} className="btn-clear-filters">
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Lista de Serviços */}
        <div className="services-content">
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
              <p className="empty-hint">
                Tente ajustar os filtros para encontrar mais resultados.
              </p>
            </div>
          ) : (
            <>
              <div className="results-header">
                <span className="results-count">
                  {totalCount} {totalCount === 1 ? 'serviço encontrado' : 'serviços encontrados'}
                </span>
              </div>
              <div className="services-grid">
                {services.map((service) => (
                  <div
                    key={service.serviceId}
                    className="service-card"
                    onClick={() => navigate(`/discover/services/${service.serviceId}`)}
                  >
                    <div className="service-card-header">
                      <h3 className="service-name">{service.name}</h3>
                      {service.availability_summary?.has_availability && (
                        <span className="availability-badge">Agenda aberta</span>
                      )}
                    </div>
                    {service.actor && (
                      <div className="service-actor">
                        Por: {service.actor.display_name || service.actor.actor_id}
                      </div>
                    )}
                    {service.shortDescription && (
                      <p className="service-description">{service.shortDescription}</p>
                    )}
                    {service.priceCents && (
                      <div className="service-price">
                        {formatCurrency(service.priceCents, service.currency)}
                        {service.pricingType && (
                          <span className="pricing-type"> / {service.pricingType}</span>
                        )}
                      </div>
                    )}
                    {service.cityId && (
                      <div className="service-location">
                        📍 Localização: {service.cityId}
                      </div>
                    )}
                    {service.availability_summary?.next_available_date && (
                      <div className="service-next-availability">
                        Próxima disponibilidade: {new Date(service.availability_summary.next_available_date).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Paginação */}
              <div className="pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={offset === 0}
                  className="btn-pagination"
                >
                  Anterior
                </button>
                <span className="pagination-info">
                  Página {Math.floor(offset / limit) + 1}
                </span>
                <button
                  onClick={handleNextPage}
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
  );
}
