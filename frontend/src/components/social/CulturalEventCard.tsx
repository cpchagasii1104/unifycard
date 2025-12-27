// src/components/social/CulturalEventCard.tsx
// Card de Evento Cultural para o Feed - FASE 16
// REGRA: Evento não é post comum, é post enriquecido

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { type CulturalEvent, getCheckInStatus, checkInToEvent, type CheckInStatus, getCheckInCount } from '../../api/cultural';
import EventCheckout from '../events/EventCheckout';
import './CulturalEventCard.css';

interface CulturalEventCardProps {
  event: CulturalEvent;
  onLike?: (eventId: string) => void;
  onShare?: (eventId: string) => void;
  onViewDetails?: (eventId: string) => void;
  onCheckIn?: (eventId: string) => void;
  sharedBy?: {
    name: string;
    source?: string; // 'group' | 'page' | 'user'
  };
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  SHOW: 'Show',
  OFICINA: 'Oficina',
  FESTIVAL: 'Festival',
  RODA: 'Roda',
  AULA: 'Aula',
  EXPOSICAO: 'Exposição',
  DEBATE: 'Debate',
  INTERVENCAO: 'Intervenção',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Aconteceu',
  CANCELLED: 'Cancelado',
  ARCHIVED: 'Arquivado',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  PUBLISHED: 'blue',
  CONFIRMED: 'green',
  COMPLETED: 'darkgreen',
  CANCELLED: 'red',
  ARCHIVED: 'gray',
};

export default function CulturalEventCard({
  event,
  onLike,
  onShare,
  onViewDetails,
  onCheckIn,
  sharedBy,
}: CulturalEventCardProps) {
  const { activeActor } = useActiveActor();
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInCount, setCheckInCount] = useState<number | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // EVENTOS ÂNCORA: Carregar contagem de check-ins
  useEffect(() => {
    if (event.status === 'PUBLISHED' || event.status === 'CONFIRMED') {
      getCheckInCount(event.id)
        .then(setCheckInCount)
        .catch((err) => {
          console.warn('Erro ao buscar contagem de check-ins:', err);
        });
    }
  }, [event.id, event.status]);

  // Carregar status de check-in
  useEffect(() => {
    if (activeActor && (event.status === 'PUBLISHED' || event.status === 'CONFIRMED')) {
      getCheckInStatus(event.id)
        .then(setCheckInStatus)
        .catch((err) => {
          console.warn('Erro ao verificar status de check-in:', err);
        });
    }
  }, [event.id, event.status, activeActor]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimestamp = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const isNearby = () => {
    // FASE 16: Lógica simplificada - depois integrar com geolocalização
    // Por enquanto, sempre retorna false
    return false;
  };

  const getActorContext = () => {
    if (!activeActor) return null;

    if (activeActor.actor_type === 'user') {
      return {
        highlight: 'location', // PF vê localização em destaque
        badge: isNearby() ? 'Próximo de você' : null,
      };
    }

    if (activeActor.actor_type === 'page') {
      // Verificar se é PAC (bar/casa) procurando eventos
      return {
        highlight: 'opportunity', // Bar vê oportunidades
        badge: event.status === 'PUBLISHED' && !event.location_cultural_profile_id
          ? 'Procurando local'
          : null,
      };
    }

    return null;
  };

  const context = getActorContext();
  const statusColor = STATUS_COLORS[event.status] || 'gray';

  const handleCheckIn = async () => {
    if (!activeActor || isCheckingIn) return;

    try {
      setIsCheckingIn(true);
      
      // Fazer check-in via QR code (método mais simples para MVP)
      // TODO: Implementar modal com QR code ou câmera para escanear
      const result = await checkInToEvent(event.id, {
        method: 'QR_CODE',
        // Por enquanto, não temos QR code - usar método AUTO temporariamente
        // Isso será melhorado quando implementarmos o modal de QR
      });

      // Atualizar status
      setCheckInStatus({
        has_checked_in: true,
        check_in_time: result.check_in.check_in_time,
        method: result.check_in.method,
        can_check_in: false,
        event_status: event.status,
        event_datetime: {
          start: event.datetime_start,
          end: event.datetime_end,
        },
      });

      // Disparar evento de impacto
      window.dispatchEvent(new CustomEvent('impact-changed', {
        detail: {
          actor_id: activeActor.actor_id,
          actor_type: activeActor.actor_type,
        },
      }));

      // Callback opcional
      onCheckIn?.(event.id);
    } catch (err) {
      console.error('Erro ao fazer check-in:', err);
      alert(err instanceof Error ? err.message : 'Erro ao fazer check-in');
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <div className="cultural-event-card">
      {/* Badge de Tipo (obrigatório) */}
      <div className="card-type-badge">
        <span className="type-badge-emoji">🎭</span>
        <span className="type-badge-label">Evento</span>
      </div>

      {sharedBy && (
        <div className="event-shared-header">
          <span className="share-icon">🔁</span>
          <span className="share-text">
            Compartilhado por <strong>{sharedBy.name}</strong>
            {sharedBy.source === 'group' && ' do grupo'}
            {sharedBy.source === 'page' && ' da página'}
          </span>
        </div>
      )}

      {/* Header padronizado */}
      <div className="event-header">
        <div className="event-creator">
          <div className="event-creator-avatar">🎭</div>
          <div className="event-creator-info">
            <span className="event-creator-name">Evento Cultural</span>
            <span className="event-creator-type">
              {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
            </span>
          </div>
        </div>
        <time className="post-time">{formatTimestamp(event.created_at || event.datetime_start)}</time>
      </div>

      <div className="event-content">
        <h3 className="event-title">{event.title}</h3>

        {event.description && (
          <p className="event-description">{event.description}</p>
        )}

        <div className="event-meta">
          <div className="event-meta-item">
            <span className="event-meta-icon">🗓️</span>
            <span className="event-meta-text">
              {formatDate(event.datetime_start)}
              {event.datetime_end && ` - ${formatTime(event.datetime_end)}`}
            </span>
          </div>

          {event.location_cultural_profile_id && (
            <div className="event-meta-item">
              <span className="event-meta-icon">📍</span>
              <span className="event-meta-text">
                Local confirmado
                {context?.badge === 'Próximo de você' && (
                  <span className="nearby-badge">Próximo de você</span>
                )}
              </span>
            </div>
          )}

          {!event.location_cultural_profile_id && event.status === 'PUBLISHED' && (
            <div className="event-meta-item">
              <span className="event-meta-icon">📍</span>
              <span className="event-meta-text event-seeking-location">
                Procurando local
              </span>
            </div>
          )}
        </div>

        {event.revenue_split && event.revenue_split.length > 0 && (
          <div className="event-split">
            <div className="event-split-label">🌱 Distribuição de Impacto:</div>
            <div className="event-split-list">
              {event.revenue_split.map((split, idx) => (
                <div key={idx} className="event-split-item">
                  <span className="split-target">
                    {split.target_type === 'CULTURAL_PROFILE' && 'Perfil: '}
                    {split.target_type === 'REGION' && 'Região: '}
                    {split.target_type === 'FUND' && 'Fundo: '}
                    {split.target_id}
                  </span>
                  <span className="split-percentage">{split.percentage}%</span>
                </div>
              ))}
            </div>
            {event.revenue_split.some((s) => s.target_type === 'REGION') && (
              <div className="event-regional-impact">
                💚 Parte do impacto volta para sua região
              </div>
            )}
          </div>
        )}

        {context?.badge && context.badge !== 'Próximo de você' && (
          <div className="event-context-badge">{context.badge}</div>
        )}

        {/* EVENTOS ÂNCORA: Contador de check-ins */}
        {checkInCount !== null && checkInCount > 0 && (
          <div className="event-checkin-count">
            ✅ {checkInCount} {checkInCount === 1 ? 'pessoa confirmou' : 'pessoas confirmaram'} presença
          </div>
        )}
      </div>

      <div className="event-actions">
        {/* FASE 17: Botão de Check-in (só aparece se evento está no horário e usuário não fez check-in) */}
        {checkInStatus?.can_check_in && (
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={isCheckingIn}
            className="event-action-btn event-action-checkin"
            aria-label="Fazer check-in no evento"
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              borderColor: '#4caf50',
            }}
          >
            {isCheckingIn ? '⏳ Fazendo check-in...' : '✅ Fazer Check-in'}
          </button>
        )}
        
        {checkInStatus?.has_checked_in && (
          <button
            type="button"
            disabled
            className="event-action-btn event-action-checkin"
            style={{
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              borderColor: '#4caf50',
              cursor: 'not-allowed',
            }}
          >
            ✓ Check-in realizado
          </button>
        )}

        <button
          type="button"
          onClick={() => onLike?.(event.id)}
          className="event-action-btn event-action-like"
          aria-label="Curtir evento"
        >
          ❤️ Curtir
        </button>
        <button
          type="button"
          onClick={() => onShare?.(event.id)}
          className="event-action-btn event-action-share"
          aria-label="Compartilhar evento"
        >
          🔁 Compartilhar
        </button>
        <button
          type="button"
          onClick={() => onViewDetails?.(event.id)}
          className="event-action-btn event-action-details"
          aria-label="Ver detalhes do evento"
        >
          👀 Ver detalhes
        </button>
        
        {/* Botão de comprar ingresso (fallback se stateInfo não estiver disponível) */}
        {!((event as any).stateInfo) && 
         event.ticket_price_cents && event.ticket_price_cents > 0 && 
         (event.status === 'PUBLISHED' || event.status === 'CONFIRMED') && (
          <button
            type="button"
            onClick={() => setShowCheckout(true)}
            className="event-action-btn event-action-buy-ticket"
            aria-label="Comprar ingresso"
          >
            🎫 Comprar Ingresso ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.ticket_price_cents / 100)})
          </button>
        )}
      </div>

      {/* Modal de checkout */}
      {showCheckout && (
        <EventCheckout
          event={event}
          onClose={() => setShowCheckout(false)}
          onSuccess={(ticketId, qrCode) => {
            setShowCheckout(false);
            // Disparar evento para atualizar feed
            window.dispatchEvent(new CustomEvent('ticket-purchased', {
              detail: { eventId: event.id, ticketId },
            }));
          }}
        />
      )}
    </div>
  );
}

