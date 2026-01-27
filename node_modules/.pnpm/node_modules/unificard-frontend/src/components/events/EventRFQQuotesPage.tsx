// frontend/src/components/events/EventRFQQuotesPage.tsx
// Página de visualização e conversão de propostas RFQ
// Exemplo de integração dos componentes de conversão

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EventRFQQuotesView from './EventRFQQuotesView';
import EventRFQConvertToBookingModal from './EventRFQConvertToBookingModal';
import EventRFQConvertToBundleModal from './EventRFQConvertToBundleModal';
import { showToast } from '../common/Toast';
import type { QuoteResponse } from '../../api/event-rfq';

export default function EventRFQQuotesPage() {
  const { eventId, rfqId } = useParams<{ eventId: string; rfqId: string }>();
  const navigate = useNavigate();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteResponse | null>(null);
  const [selectedQuotes, setSelectedQuotes] = useState<QuoteResponse[]>([]);

  if (!eventId || !rfqId) {
    return <div>Evento ou RFQ não fornecido</div>;
  }

  const handleConvertToBooking = (quote: QuoteResponse) => {
    setSelectedQuote(quote);
    setShowBookingModal(true);
  };

  const handleConvertToBundle = (quotes: QuoteResponse[]) => {
    setSelectedQuotes(quotes);
    setShowBundleModal(true);
  };

  const handleBookingSuccess = (bookingId: string) => {
    showToast('Booking criado com sucesso!', 'success');
    // Opcional: navegar para página do booking
    // navigate(`/service-orders?bookingId=${bookingId}`);
  };

  const handleBundleSuccess = (bundleId: string, bookingIds: string[]) => {
    showToast(`Bundle criado com sucesso! ${bookingIds.length} booking(s) criado(s).`, 'success');
    // Opcional: navegar para página do bundle
    // navigate(`/service-bundles/${bundleId}`);
  };

  return (
    <div className="event-rfq-quotes-page">
      <div className="page-header">
        <button onClick={() => navigate(`/events/${eventId}`)} className="btn-back">
          ← Voltar ao Evento
        </button>
        <h1>Propostas do RFQ</h1>
      </div>

      <EventRFQQuotesView
        eventId={eventId}
        rfqId={rfqId}
        onConvertToBooking={handleConvertToBooking}
        onConvertToBundle={handleConvertToBundle}
        allowMultipleSelection={true}
      />

      {showBookingModal && selectedQuote && (
        <EventRFQConvertToBookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedQuote(null);
          }}
          onSuccess={handleBookingSuccess}
          eventId={eventId}
          rfqId={rfqId}
          quote={selectedQuote}
        />
      )}

      {showBundleModal && selectedQuotes.length >= 2 && (
        <EventRFQConvertToBundleModal
          isOpen={showBundleModal}
          onClose={() => {
            setShowBundleModal(false);
            setSelectedQuotes([]);
          }}
          onSuccess={handleBundleSuccess}
          eventId={eventId}
          rfqId={rfqId}
          quotes={selectedQuotes}
        />
      )}
    </div>
  );
}




