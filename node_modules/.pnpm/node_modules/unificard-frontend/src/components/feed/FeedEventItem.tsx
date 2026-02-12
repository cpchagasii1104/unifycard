// src/components/feed/FeedEventItem.tsx
// Componente para renderizar item de evento no feed via plugin
// Consome DTO do EventFeedPlugin

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FeedItemDTO } from '../../api/feedPlugins';
import { FeedAction } from '../../api/feedPlugins';
import './FeedEventItem.css';

interface FeedEventItemProps {
  dto: FeedItemDTO;
  postId: string; // Mantido para referência futura
}

export default function FeedEventItem({ dto }: FeedEventItemProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const eventId = dto.metadata?.eventId;
  const datetimeStart = dto.metadata?.datetimeStart;
  const datetimeEnd = dto.metadata?.datetimeEnd;
  const status = dto.metadata?.status;
  const price = dto.metadata?.price;
  const eventType = dto.metadata?.eventType;

  const handleAction = async (action: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      switch (action) {
        case FeedAction.VIEW:
          // Navegar para página do evento
          if (eventId) {
            navigate(`/events/${eventId}`);
          }
          break;

        case FeedAction.BUY:
          // Navegar para checkout/tickets do evento
          if (eventId) {
            navigate(`/events/${eventId}/checkout`);
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

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="feed-event-item">
      <div className="event-badge">🎉 Evento</div>

      <h3 className="event-title">{dto.title}</h3>

      {dto.description && (
        <p className="event-description">{dto.description}</p>
      )}

      {datetimeStart && (
        <div className="event-datetime">
          <strong>Início:</strong> {formatDate(datetimeStart)}
        </div>
      )}

      {datetimeEnd && (
        <div className="event-datetime">
          <strong>Fim:</strong> {formatDate(datetimeEnd)}
        </div>
      )}

      {eventType && (
        <div className="event-type">
          <strong>Tipo:</strong> {eventType}
        </div>
      )}

      {status && (
        <div className="event-status">
          <strong>Status:</strong> {status}
        </div>
      )}

      {price && (
        <div className="event-price">
          <strong>Preço:</strong> {formatCurrency(price.amount, price.currency || 'BRL')}
        </div>
      )}

      {dto.availableActions && dto.availableActions.length > 0 && (
        <div className="event-actions">
          {dto.availableActions.includes(FeedAction.VIEW) && (
            <button
              className="btn-view"
              onClick={() => handleAction(FeedAction.VIEW)}
              disabled={isLoading}
            >
              Ver Detalhes
            </button>
          )}

          {dto.availableActions.includes(FeedAction.BUY) && (
            <button
              className="btn-buy"
              onClick={() => handleAction(FeedAction.BUY)}
              disabled={isLoading}
            >
              Comprar Ingresso
            </button>
          )}
        </div>
      )}
    </div>
  );
}

