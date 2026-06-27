// src/pages/ServicesListPage.tsx
// Lista de Serviços (Catálogo)
// SPRINT: Services MVP

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listActorServices,
  type Service,
  type ServiceStatus,
} from '../api/services';
import { showToast } from '../components/common/Toast';
import './ServicesListPage.css';

export default function ServicesListPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | 'ALL'>('ALL');

  useEffect(() => {
    loadServices();
  }, [activeActor, statusFilter]);

  const loadServices = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      const data = await listActorServices(activeActor.actor_id, filters);
      setServices(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar serviços');
      showToast(err.message || 'Erro ao carregar serviços', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: ServiceStatus): string => {
    const labels: Record<ServiceStatus, string> = {
      draft: 'Rascunho',
      active: 'Ativo',
      paused: 'Pausado',
    };
    return labels[status] || status;
  };

  const getServiceTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      service: 'Serviço',
      rental: 'Aluguel',
      event: 'Evento',
      job: 'Trabalho',
    };
    return labels[type] || type;
  };

  const formatPrice = (priceCents: number | null, currency: string | null): string => {
    if (!priceCents || !currency) return 'A consultar';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(priceCents / 100);
  };

  if (isLoading) {
    return (
      <div className="services-list-page">
        <div className="loading">Carregando serviços...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="services-list-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadServices}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="services-list-page">
      <div className="page-header">
        <h1>Meus Serviços</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/services/new')} className="btn-primary">
            Novo Serviço
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ServiceStatus | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="draft">Rascunho</option>
            <option value="active">Ativo</option>
            <option value="paused">Pausado</option>
          </select>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum serviço encontrado.</p>
          <button onClick={() => navigate('/services/new')} className="btn-primary">
            Criar Primeiro Serviço
          </button>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((service) => (
            <div
              key={service.serviceId}
              className="service-card"
              onClick={() => navigate(`/services/${service.serviceId}`)}
            >
              <div className="service-header">
                <h3 className="service-name">{service.name}</h3>
                <span className={`service-status status-${service.status}`}>
                  {getStatusLabel(service.status)}
                </span>
              </div>
              <div className="service-body">
                {service.shortDescription && (
                  <p className="service-description">{service.shortDescription}</p>
                )}
                <div className="service-meta">
                  <span className="service-type">{getServiceTypeLabel(service.serviceType)}</span>
                  {service.priceCents && (
                    <span className="service-price">
                      {formatPrice(service.priceCents, service.currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




