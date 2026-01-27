// src/components/feed/FeedServiceItem.tsx
// Componente para renderizar item de serviço no feed via plugin
// Consome DTO do ServicesFeedPlugin

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItemDTO } from '../../api/feedPlugins';
import { FeedAction } from '../../api/feedPlugins';
import './FeedServiceItem.css';

interface FeedServiceItemProps {
  dto: FeedItemDTO;
  postId: string; // Mantido para referência futura
  onBookClick?: () => void; // Callback para abrir fluxo de booking existente
}

export default function FeedServiceItem({ dto, onBookClick }: FeedServiceItemProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const serviceId = dto.metadata?.serviceId;
  const status = dto.metadata?.status;
  const serviceType = dto.metadata?.serviceType;
  const pricingType = dto.metadata?.pricingType;
  const price = dto.metadata?.price;
  const city = dto.metadata?.city;
  const neighborhood = dto.metadata?.neighborhood;

  const handleAction = async (action: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      switch (action) {
        case FeedAction.VIEW:
          // Navegar para página do serviço
          if (serviceId) {
            navigate(`/services/${serviceId}`);
          }
          break;

        case FeedAction.BOOK:
          // Abrir fluxo de booking existente
          // 🔴 BLINDAGEM: Booking é domínio, não feed - delegar para callback
          if (onBookClick) {
            onBookClick();
          } else {
            // Fallback: navegar para página de booking do serviço
            if (serviceId) {
              navigate(`/services/${serviceId}/book`);
            }
          }
          break;

        default:
          console.warn('Ação não implementada:', action);
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getPricingLabel = (pricingType: string | null | undefined): string => {
    switch (pricingType) {
      case 'hourly':
        return 'Por hora';
      case 'daily':
        return 'Por dia';
      case 'weekly':
        return 'Por semana';
      case 'monthly':
        return 'Por mês';
      case 'fixed':
        return 'Valor fixo';
      case 'quote':
        return 'Solicitar orçamento';
      default:
        return '';
    }
  };

  return (
    <div className="feed-service-item">
      <div className="service-badge">🔧 Serviço</div>

      <h3 className="service-title">{dto.title}</h3>

      {dto.description && (
        <p className="service-description">{dto.description}</p>
      )}

      {serviceType && (
        <div className="service-type">
          <strong>Tipo:</strong> {serviceType}
        </div>
      )}

      {status && (
        <div className="service-status">
          <strong>Status:</strong> {status}
        </div>
      )}

      {price && (
        <div className="service-price">
          <strong>
            {pricingType && getPricingLabel(pricingType) ? `${getPricingLabel(pricingType)}: ` : 'Preço: '}
          </strong>
          {pricingType === 'quote' ? (
            'Solicitar orçamento'
          ) : (
            formatCurrency(price.amount, price.currency || 'BRL')
          )}
        </div>
      )}

      {(city || neighborhood) && (
        <div className="service-location">
          <strong>Localização:</strong>{' '}
          {neighborhood && `${neighborhood}, `}
          {city && `Cidade ID: ${city}`}
        </div>
      )}

      {dto.availableActions && dto.availableActions.length > 0 && (
        <div className="service-actions">
          {dto.availableActions.includes(FeedAction.VIEW) && (
            <button
              className="btn-view"
              onClick={() => handleAction(FeedAction.VIEW)}
              disabled={isLoading}
            >
              Ver Detalhes
            </button>
          )}

          {dto.availableActions.includes(FeedAction.BOOK) && (
            <button
              className="btn-book"
              onClick={() => handleAction(FeedAction.BOOK)}
              disabled={isLoading}
            >
              Agendar Serviço
            </button>
          )}
        </div>
      )}
    </div>
  );
}

