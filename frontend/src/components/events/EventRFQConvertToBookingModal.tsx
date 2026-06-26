// frontend/src/components/events/EventRFQConvertToBookingModal.tsx
// Modal para converter proposta RFQ em Booking
//
// F-EVENT-RFQ-SERVICE-BOOKING-DEAD-END-QUARANTINE (2026-06-26):
//   Esta superfície chamava createServiceBooking() de api/service-bookings.ts, que bate em
//   POST /services/:serviceId/bookings — rota inexistente no backend atual (sobra de System-A → 404).
//   A booking canônica vive no core (unified-availability), não aqui. Em vez de um formulário de
//   conversão que termina em 404 (mentira viva), o modal agora é um TERMINAL HONESTO: informa que
//   o fluxo evento/RFQ → reserva será tratado em frente própria e NÃO cria nada.
//   - NÃO chama createServiceBooking (rota morta) nem qualquer escrita.
//   - NÃO repõe para /availability/bookings nem cria booking canônica.
//   - NÃO converte RFQ, NÃO cria pagamento, NÃO cria split, NÃO resolve eventos/RFQ.
//   - NÃO simula sucesso (onSuccess nunca é disparado).
//   Props/interface preservados para não quebrar os call-sites (EventRFQQuotesPage).

import type { QuoteResponse } from '../../api/event-rfq';
import './EventRFQConvertToBookingModal.css';

interface EventRFQConvertToBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
  eventId: string;
  rfqId: string;
  quote: QuoteResponse;
}

export default function EventRFQConvertToBookingModal({
  isOpen,
  onClose,
  rfqId,
  quote,
}: EventRFQConvertToBookingModalProps) {
  if (!isOpen) return null;

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  return (
    <div className="event-rfq-convert-booking-modal-overlay" onClick={onClose}>
      <div className="event-rfq-convert-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Converter Proposta em Booking</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="conversion-warning">
            <strong>⚠️ Conversão de proposta em reserva indisponível nesta etapa.</strong>
            <p>
              O fluxo de evento/RFQ → reserva será tratado em frente própria.
              Nenhuma reserva, pagamento ou split é criado por aqui.
            </p>
          </div>

          <div className="quote-summary">
            <h3>Proposta Selecionada</h3>
            <div className="summary-item">
              <strong>Serviço:</strong> {quote.serviceId}
            </div>
            <div className="summary-item">
              <strong>Valor Proposto:</strong> {formatPrice(quote.priceCents, quote.currency)}
            </div>
            <div className="summary-item">
              <strong>RFQ:</strong> {rfqId.substring(0, 8)}...
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
