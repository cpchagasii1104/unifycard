// frontend/src/components/events/EventRFQQuotesView.tsx
// Visualização e comparação de propostas de RFQ
// 🔴 BLINDAGEM: NÃO aceita proposta automaticamente
// 🔴 BLINDAGEM: NÃO cria booking automaticamente

import { useState, useEffect } from 'react';
import { getRFQQuotes, getRFQById, type QuoteResponse, type EventRFQ } from '../../api/event-rfq';
import { getService } from '../../api/services';
import { getActorProfile } from '../../api/social';
import { showToast } from '../common/Toast';
import './EventRFQQuotesView.css';

interface EventRFQQuotesViewProps {
  eventId: string;
  rfqId: string;
  onQuoteSelect?: (quote: QuoteResponse) => void;
  onConvertToBooking?: (quote: QuoteResponse) => void;
  onConvertToBundle?: (quotes: QuoteResponse[]) => void;
  allowMultipleSelection?: boolean;
}

export default function EventRFQQuotesView({
  eventId,
  rfqId,
  onQuoteSelect,
  onConvertToBooking,
  onConvertToBundle,
  allowMultipleSelection = false,
}: EventRFQQuotesViewProps) {
  const [rfq, setRFQ] = useState<EventRFQ | null>(null);
  const [quotes, setQuotes] = useState<QuoteResponse[]>([]);
  const [enrichedQuotes, setEnrichedQuotes] = useState<Array<QuoteResponse & {
    service?: any;
    provider?: any;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'date'>('price');
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);

  useEffect(() => {
    if (eventId && rfqId) {
      loadRFQAndQuotes();
    }
  }, [eventId, rfqId]);

  const loadRFQAndQuotes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carregar RFQ
      const rfqData = await getRFQById(eventId, rfqId);
      setRFQ(rfqData);

      // Carregar propostas
      const quotesData = await getRFQQuotes(eventId, rfqId);
      setQuotes(quotesData.quotes);

      // Enriquecer propostas com dados de serviço e prestador
      const enriched = await Promise.all(
        quotesData.quotes.map(async (quote) => {
          try {
            const service = await getService(quote.serviceId);
            const provider = await getActorProfile(quote.providerActorId);
            return {
              ...quote,
              service,
              provider,
            };
          } catch (err) {
            return quote;
          }
        })
      );

      setEnrichedQuotes(enriched);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar propostas');
      showToast(err.message || 'Erro ao carregar propostas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const sortedQuotes = [...enrichedQuotes].sort((a, b) => {
    if (sortBy === 'price') {
      return a.priceCents - b.priceCents;
    } else {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
  });

  if (isLoading) {
    return (
      <div className="event-rfq-quotes-view">
        <div className="loading">Carregando propostas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-rfq-quotes-view">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="event-rfq-quotes-view">
      <div className="quotes-header">
        <h3>Propostas Recebidas</h3>
        {rfq && (
          <div className="rfq-info">
            <span className={`status-badge ${rfq.status === 'open' ? 'status-open' : 'status-closed'}`}>
              {rfq.status === 'open' ? 'Aberto' : 'Fechado'}
            </span>
            <span className="quotes-count">{quotes.length} proposta(s)</span>
          </div>
        )}
      </div>

      {quotes.length === 0 ? (
        <div className="no-quotes">
          <p>Nenhuma proposta recebida ainda.</p>
          {rfq?.status === 'open' && (
            <p className="help-text">O RFQ está aberto e aceitando propostas.</p>
          )}
        </div>
      ) : (
        <>
          <div className="quotes-controls">
            <label>
              Ordenar por:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'price' | 'date')}>
                <option value="price">Preço (menor primeiro)</option>
                <option value="date">Data (mais recente primeiro)</option>
              </select>
            </label>
            {allowMultipleSelection && selectedQuotes.length > 0 && (
              <div className="selection-actions">
                <span className="selected-count">{selectedQuotes.length} selecionada(s)</span>
                {onConvertToBundle && selectedQuotes.length > 1 && (
                  <button
                    className="btn-convert-bundle"
                    onClick={() => {
                      const selected = sortedQuotes.filter(q => selectedQuotes.includes(q.quoteId));
                      onConvertToBundle(selected);
                    }}
                  >
                    Converter para Bundle ({selectedQuotes.length} propostas)
                  </button>
                )}
                <button
                  className="btn-clear-selection"
                  onClick={() => setSelectedQuotes([])}
                >
                  Limpar Seleção
                </button>
              </div>
            )}
          </div>

          <div className="quotes-list">
            {sortedQuotes.map((quote) => (
              <div key={quote.quoteId} className={`quote-card ${allowMultipleSelection && selectedQuotes.includes(quote.quoteId) ? 'selected' : ''}`}>
                {allowMultipleSelection && (
                  <div className="quote-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedQuotes.includes(quote.quoteId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedQuotes([...selectedQuotes, quote.quoteId]);
                        } else {
                          setSelectedQuotes(selectedQuotes.filter(id => id !== quote.quoteId));
                        }
                      }}
                    />
                  </div>
                )}
                <div className="quote-header">
                  <div className="quote-service">
                    <h4>{quote.service?.name || quote.serviceId}</h4>
                    {quote.provider && (
                      <p className="quote-provider">
                        Prestador: {quote.provider.display_name || quote.providerActorId}
                      </p>
                    )}
                  </div>
                  <div className="quote-price">
                    <strong>{formatPrice(quote.priceCents, quote.currency)}</strong>
                  </div>
                </div>

                {quote.notes && (
                  <div className="quote-notes">
                    <strong>Observações:</strong>
                    <p>{quote.notes}</p>
                  </div>
                )}

                <div className="quote-details">
                  <div className="detail-item">
                    <span className="detail-label">Moeda:</span>
                    <span>{quote.currency}</span>
                  </div>
                  {quote.validUntil && (
                    <div className="detail-item">
                      <span className="detail-label">Válido até:</span>
                      <span>{new Date(quote.validUntil).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Recebido em:</span>
                    <span>{new Date(quote.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="quote-actions">
                  {onQuoteSelect && (
                    <button
                      className="btn-select"
                      onClick={() => onQuoteSelect(quote)}
                    >
                      Selecionar Proposta
                    </button>
                  )}
                  {onConvertToBooking && (
                    <button
                      className="btn-convert-booking"
                      onClick={() => onConvertToBooking(quote)}
                    >
                      Converter para Booking
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

