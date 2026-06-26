// src/components/events/EventServiceBookingRequestModal.tsx
// Modal de Solicitação de Booking Contextual para Eventos
//
// F-EVENT-RFQ-SERVICE-BOOKING-DEAD-END-QUARANTINE (2026-06-26):
//   Esta superfície chamava createServiceBooking() de api/service-bookings.ts, que bate em
//   POST /services/:serviceId/bookings — rota inexistente no backend atual (sobra de System-A → 404).
//   A booking canônica vive no core (unified-availability), não aqui. Em vez de oferecer um
//   formulário que termina em 404 (mentira viva), o modal agora é um TERMINAL HONESTO: informa que
//   o fluxo evento → reserva será tratado em frente própria e NÃO cria nada.
//   - NÃO chama createServiceBooking (rota morta) nem qualquer escrita.
//   - NÃO repõe para /availability/bookings nem cria booking canônica.
//   - NÃO resolve eventos/RFQ — contenção apenas.
//   - NÃO simula sucesso (onSuccess nunca é disparado).
//   Props/interface preservados para não quebrar os call-sites (EventPage).

import './EventServiceBookingRequestModal.css';

export interface EventServiceBookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventId: string;
  serviceId: string;
  actorId: string; // Prestador
  serviceName: string;
  actorName: string | null;
}

export default function EventServiceBookingRequestModal({
  isOpen,
  onClose,
  serviceName,
  actorName,
}: EventServiceBookingRequestModalProps) {
  if (!isOpen) return null;

  return (
    <div className="event-booking-request-modal-overlay" onClick={onClose}>
      <div className="event-booking-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Solicitar Booking</h2>
          <button onClick={onClose} className="modal-close-btn">×</button>
        </div>

        <div className="modal-content">
          <div className="warning-banner">
            <p>
              <strong>⚠️ Solicitação de booking indisponível nesta etapa.</strong>
            </p>
            <p>
              O fluxo de evento → reserva de serviço será tratado em frente própria.
              Nenhuma reserva é criada por aqui.
            </p>
          </div>

          <div className="info-section">
            <h3>Serviço / Artista</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Serviço:</strong> {serviceName}
              </div>
              {actorName && (
                <div className="info-item">
                  <strong>Prestador:</strong> {actorName}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="btn-cancel">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
