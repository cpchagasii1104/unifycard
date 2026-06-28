// src/pages/ServiceDetailPage.tsx
// Detalhe de Serviço
// SPRINT: Services MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getService, type Service } from '../api/services';
import { showToast } from '../components/common/Toast';
import './ServiceDetailPage.css';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadService();
    }
  }, [id]);

  const loadService = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getService(id);
      setService(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar serviço');
      showToast(err.message || 'Erro ao carregar serviço', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
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
      <div className="service-detail-page">
        <div className="loading">Carregando serviço...</div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="service-detail-page">
        <div className="error">
          <p>{error || 'Serviço não encontrado'}</p>
          <button onClick={() => navigate('/services')}>Voltar para Lista</button>
        </div>
      </div>
    );
  }

  return (
    <div className="service-detail-page">
      <div className="page-header">
        <button onClick={() => navigate('/services')}>← Voltar</button>
        <h1>{service.name}</h1>
        <span className={`service-status status-${service.status}`}>
          {getStatusLabel(service.status)}
        </span>
      </div>

      <div className="service-content">
        <div className="service-main">
          <div className="service-section">
            <h2>Informações Gerais</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Tipo:</label>
                <span>{getServiceTypeLabel(service.serviceType)}</span>
              </div>
              <div className="info-item">
                <label>Status:</label>
                <span>{getStatusLabel(service.status)}</span>
              </div>
              {service.priceCents && (
                <div className="info-item">
                  <label>Preço:</label>
                  <span>{formatPrice(service.priceCents, service.currency)}</span>
                </div>
              )}
            </div>
          </div>

          {service.description && (
            <div className="service-section">
              <h2>Descrição</h2>
              <p className="service-description">{service.description}</p>
            </div>
          )}

          {(service.countryId || service.stateId || service.cityId || service.neighborhood) && (
            <div className="service-section">
              <h2>Localização</h2>
              <div className="location-info">
                {service.neighborhood && <span>{service.neighborhood}</span>}
                {service.cityId && <span>CID: {service.cityId.substring(0, 8)}...</span>}
                {service.stateId && <span>EST: {service.stateId.substring(0, 8)}...</span>}
                {service.countryId && <span>PAÍS: {service.countryId.substring(0, 8)}...</span>}
              </div>
            </div>
          )}
        </div>

        <div className="service-actions">
          <div className="action-section">
            <h3>Gerenciar</h3>
            {/* F-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-SLICE-A (2026-06-27): porta VIVA da oferta —
                editar preço/duração e adicionar janela de disponibilidade da OFERTA pós-publicação
                (owner_type='service_offering'). Substitui o beco onde só havia o terminal honesto. */}
            <button
              onClick={() => navigate(`/services/${service.serviceId}/offering`)}
              className="btn-action"
            >
              Gerenciar oferta e agenda
            </button>
            {/* Terminal honesto preservado: explica a LEI (a agenda reservável é a da oferta, não do
                service). Não ressuscita agenda service-level. */}
            <button
              onClick={() => navigate(`/services/${service.serviceId}/availability`)}
              className="btn-action"
            >
              Disponibilidade
            </button>
            {/* F-SERVICE-BOOKING-ORPHAN-SURFACE-QUARANTINE (2026-06-26): CTA "Reservas" removido —
                levava a /services/:id/bookings (superfície órfã/oca, writer em rota 404). As reservas
                pendentes vivem na Central do prestador (/services) pelo fluxo canônico de decisão. */}
          </div>
        </div>
      </div>
    </div>
  );
}




