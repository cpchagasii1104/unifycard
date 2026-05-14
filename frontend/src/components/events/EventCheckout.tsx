// src/components/events/EventCheckout.tsx
// Checkout de ingresso para eventos culturais

import { useState } from 'react';
import { checkoutTicket } from '../../api/checkout';
import { type CulturalEvent } from '../../api/cultural';
import { showToast } from '../common/Toast';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import TransactionSplitDetail from '../governance/TransactionSplitDetail';
import RegionalFundCard from '../governance/RegionalFundCard';
import './EventCheckout.css';

interface EventCheckoutProps {
  event: CulturalEvent;
  onClose: () => void;
  onSuccess?: (ticketId: string, qrCode: string) => void;
}


export default function EventCheckout({ event, onClose, onSuccess }: EventCheckoutProps) {
  const { activeActor } = useActiveActor();
  const [step, setStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState<{ ticketId: string; qrCode: string; transactionId?: string } | null>(null);

  const ticketPrice = event.ticket_price_cents ? event.ticket_price_cents / 100 : 0;

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  const handleConfirm = async () => {
    if (!activeActor) {
      setError('Você precisa estar autenticado para comprar ingressos');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      const result = await checkoutTicket({
        eventId: event.id,
        idempotencyKey: `ticket_${event.id}_${activeActor.actor_id}_${Date.now()}`,
      });

      if (!result.success) {
        throw new Error((result as any).error || 'Erro ao processar compra');
      }

      setTicketData({
        ticketId: result.ticketId,
        qrCode: result.qrCode || '',
        transactionId: result.transactionId,
      });

      setStep('success');

      // Mostrar toast simples
      showToast('Ingresso comprado com sucesso!', 'success');

      // Disparar eventos
      window.dispatchEvent(new CustomEvent('impact-changed', {
        detail: {
          actor_id: activeActor.actor_id,
          actor_type: activeActor.actor_type,
        },
      }));

      window.dispatchEvent(new CustomEvent('ticket-purchased', {
        detail: {
          eventId: event.id,
          ticketId: result.ticketId,
        },
      }));

      // Não fechar automaticamente - usuário escolhe quando fechar via botões do resumo
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar compra');
      setStep('error');
      showToast('Erro ao comprar ingresso. Tente novamente.', 'error');
    }
  };

  if (step === 'success') {
    return (
      <div className="event-checkout-overlay" onClick={onClose}>
        <div className="event-checkout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="event-checkout-success">
            <div className="success-icon">✓</div>
            <h2>Ingresso Comprado!</h2>
            <p>Seu ingresso foi adquirido com sucesso.</p>
            {ticketData?.qrCode && (
              <div className="qr-code-preview">
                <p className="qr-code-label">Código QR:</p>
                <code className="qr-code-value">{ticketData.qrCode.substring(0, 20)}...</code>
              </div>
            )}

            {ticketData?.transactionId && (
              <TransactionSplitDetail transactionId={ticketData.transactionId} />
            )}

            <RegionalFundCard />

            <div className="event-checkout-success-actions">
              <button
                className="event-checkout-action-secondary"
                onClick={() => {
                  window.location.href = '/social/ledger';
                }}
              >
                Ver Extrato
              </button>
              <button
                className="event-checkout-action-primary"
                onClick={() => {
                  if (onSuccess && ticketData?.ticketId && ticketData?.qrCode) {
                    onSuccess(ticketData.ticketId, ticketData.qrCode);
                  }
                  onClose();
                }}
              >
                Voltar ao Feed
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-checkout-overlay" onClick={onClose}>
      <div className="event-checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-checkout-header">
          <h2>🎫 Comprar Ingresso</h2>
          <button className="event-checkout-close" onClick={onClose}>×</button>
        </div>

        <div className="event-checkout-content">
          {/* Informações do evento */}
          <div className="event-checkout-info">
            <h3 className="event-checkout-title">{event.title}</h3>
            <div className="event-checkout-meta">
              <div className="event-checkout-meta-item">
                <span className="meta-icon">🗓️</span>
                <span className="meta-text">{formatDate(event.datetime_start)}</span>
              </div>
              {event.location_cultural_profile_id && (
                <div className="event-checkout-meta-item">
                  <span className="meta-icon">📍</span>
                  <span className="meta-text">Local confirmado</span>
                </div>
              )}
            </div>
          </div>

          {/* Preço */}
          <div className="event-checkout-price">
            <span className="price-label">Valor do ingresso:</span>
            <span className="price-value">{formatPrice(event.ticket_price_cents || 0)}</span>
          </div>

          {/* Nota sobre distribuição */}
          <div className="event-checkout-note">
            <span className="note-icon">💚</span>
            <p className="note-text">
              O valor será distribuído automaticamente pelo Split Engine (organizador, plataforma, região e comunidade).
            </p>
          </div>

          {/* Erro */}
          {error && (
            <div className="event-checkout-error">
              <p>{error}</p>
              <button onClick={() => { setError(null); setStep('confirm'); }}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <div className="event-checkout-actions">
          <button
            className="event-checkout-cancel"
            onClick={onClose}
            disabled={step === 'processing'}
          >
            Cancelar
          </button>
          <button
            className="event-checkout-submit"
            onClick={handleConfirm}
            disabled={step === 'processing' || ticketPrice <= 0}
          >
            {step === 'processing' ? 'Processando...' : 'Confirmar Compra'}
          </button>
        </div>
      </div>
    </div>
  );
}

