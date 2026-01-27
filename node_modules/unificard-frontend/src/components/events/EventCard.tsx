// src/components/events/EventCard.tsx
// 🔴 CRÍTICO: Read-only, nenhuma mutation financeira
import { useState, useEffect } from 'react';
import { getEventAvailabilityPreview, trackEventMetric, type AvailabilityPreview as AvailabilityPreviewType } from '../../api/events';
import EventStatusBadge from './EventStatusBadge';
import AvailabilityPreview from './AvailabilityPreview';
import './EventCard.css';

export interface EventCardProps {
  eventId: string;
  title: string;
  eventType: string;
  cityId: string | null;
  status: string;
  ticketPrice: number | null;
  acceptsConsumption: boolean;
  onClick: () => void; // Navega para página do evento
}

export default function EventCard({
  eventId,
  title,
  eventType,
  cityId,
  status,
  ticketPrice,
  onClick,
}: EventCardProps) {
  const [availability, setAvailability] = useState<AvailabilityPreviewType | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Registrar visualização quando card aparece no feed
  useEffect(() => {
    if (!hasTrackedView && (status === 'PUBLISHED' || status === 'ONGOING')) {
      trackEventMetric(eventId, 'VIEW', { source: 'feed' });
      setHasTrackedView(true);
    }
  }, [eventId, status, hasTrackedView]);

  // Carregar preview de disponibilidade
  useEffect(() => {
    if (status === 'PUBLISHED' || status === 'ONGOING') {
      getEventAvailabilityPreview(eventId)
        .then(setAvailability)
        .catch((error) => {
          console.error('Erro ao carregar preview de disponibilidade:', error);
        });
    }
  }, [eventId, status]);

  const formatEventType = (type: string): string => {
    const types: Record<string, string> = {
      SHOW: 'Show',
      CINEMA: 'Cinema',
      ESPORTE: 'Esporte',
      BAR: 'Bar',
      RESTAURANTE: 'Restaurante',
      FEIRA: 'Feira',
      WORKSHOP: 'Workshop',
      EXPOSICAO: 'Exposição',
      FESTIVAL: 'Festival',
      BALADA: 'Balada',
    };
    return types[type] || type;
  };

  return (
    <div className="event-card" onClick={onClick}>
      {/* Badge de Tipo (obrigatório) */}
      <div className="card-type-badge">
        <span className="type-badge-emoji">🎭</span>
        <span className="type-badge-label">Evento</span>
      </div>

      {/* Header padronizado */}
      <div className="event-card-header">
        <div className="event-card-author">
          <div className="event-card-avatar">🎭</div>
          <div className="event-card-author-info">
            <span className="event-card-author-name">{formatEventType(eventType)}</span>
          </div>
        </div>
        <EventStatusBadge status={status} />
      </div>

      <div className="event-card-content">
        <h3 className="event-card-title">{title}</h3>

        <div className="event-card-info">
          {cityId && <span className="event-card-city">📍 {cityId}</span>}
        </div>

        {availability && availability.nextAvailableSlots.length > 0 && (
          <div className="event-card-availability">
            <AvailabilityPreview slots={availability.nextAvailableSlots} timezone={availability.timezone} />
          </div>
        )}

        {ticketPrice !== null && ticketPrice > 0 && (
          <div className="event-card-price">
            💵 Ingressos a partir de R$ {ticketPrice.toFixed(2)}
          </div>
        )}

        <button className="event-card-cta" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          Ver Evento
        </button>
      </div>
    </div>
  );
}




