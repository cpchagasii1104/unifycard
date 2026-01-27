// frontend/src/components/evidence/EvidenceTimeline.tsx
// Timeline única de evidências (chat + agreement + ações)
// 🔴 BLINDAGEM: Apenas leitura, sem cálculos

import { type EvidenceEvent } from '../../api/evidence';
import './EvidenceTimeline.css';

interface EvidenceTimelineProps {
  events: EvidenceEvent[];
}

export default function EvidenceTimeline({ events }: EvidenceTimelineProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      message_sent: 'Mensagem Enviada',
      agreement_created: 'Acordo Criado',
      agreement_updated: 'Acordo Atualizado',
      agreement_proposed: 'Acordo Proposto',
      agreement_accepted: 'Acordo Aceito',
      agreement_finalized: 'Acordo Finalizado',
      booking_created: 'Booking Criado',
      booking_decided: 'Booking Decidido',
      booking_confirmed: 'Booking Confirmado',
      service_order_created: 'Ordem de Serviço Criada',
      service_order_confirmed: 'Ordem de Serviço Confirmada',
      bundle_created: 'Bundle Criado',
      bundle_confirmed: 'Bundle Confirmado',
      financial_terms_confirmed: 'Termos Financeiros Confirmados',
      bypass_attempted: 'Tentativa de Bypass',
      dispute_opened: 'Disputa Aberta',
      dispute_resolved: 'Disputa Resolvida',
    };
    return labels[eventType] || eventType;
  };

  const getEventIcon = (eventType: string, source: string) => {
    if (source === 'chat') return '💬';
    if (source === 'agreement') return '📋';
    if (source === 'audit') return '📝';
    if (eventType === 'dispute_opened') return '⚠️';
    if (eventType === 'dispute_resolved') return '✅';
    if (eventType === 'bypass_attempted') return '🚫';
    return '•';
  };

  const getEventColor = (eventType: string, source: string) => {
    if (eventType === 'dispute_opened') return 'dispute-open';
    if (eventType === 'dispute_resolved') return 'dispute-resolved';
    if (eventType === 'bypass_attempted') return 'bypass';
    if (source === 'chat') return 'chat';
    if (source === 'agreement') return 'agreement';
    if (source === 'audit') return 'audit';
    return 'default';
  };

  if (events.length === 0) {
    return (
      <div className="evidence-timeline-empty">
        <p>Nenhum evento registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="evidence-timeline">
      {events.map((event, index) => (
        <div
          key={event.eventId}
          className={`timeline-event timeline-event-${getEventColor(event.eventType, event.source)}`}
        >
          <div className="timeline-event-marker">
            <span className="timeline-event-icon">{getEventIcon(event.eventType, event.source)}</span>
          </div>
          <div className="timeline-event-content">
            <div className="timeline-event-header">
              <strong>{getEventLabel(event.eventType)}</strong>
              <span className="timeline-event-source">{event.source}</span>
            </div>
            <div className="timeline-event-time">{formatDate(event.timestamp)}</div>
            <div className="timeline-event-actor">
              Por: {event.actorId.substring(0, 8)}...
            </div>
            {event.data && Object.keys(event.data).length > 0 && (
              <div className="timeline-event-data">
                <details>
                  <summary>Detalhes</summary>
                  <pre>{JSON.stringify(event.data, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>
          {index < events.length - 1 && <div className="timeline-event-connector" />}
        </div>
      ))}
    </div>
  );
}




