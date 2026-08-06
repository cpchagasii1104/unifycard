// src/components/events/EventCheckoutModal.tsx
// Modal de Checkout de Ingresso - Bloco 3.2
// Processa compra real via backend

import { useState } from 'react';
import { type CulturalEvent } from '../../api/cultural';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { validateActiveActor, safeNumber, safeArray, safeApiCall, safeString } from '../../utils/guardrails';
import { devLog } from '../../utils/devLog';
import { checkoutTicket, type CheckoutTicketResponse } from '../../api/checkout';
import { showToast } from '../common/Toast';
import TransactionImpactSummary from '../social/TransactionImpactSummary';
import './EventCheckoutModal.css';

interface EventCheckoutModalProps {
  event: CulturalEvent;
  onClose: () => void;
  onSuccess?: (ticketId: string, qrCode: string) => void;
}

export default function EventCheckoutModal({ event, onClose, onSuccess }: EventCheckoutModalProps) {
  const { activeActor } = useActiveActor();
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'preview' | 'processing' | 'success' | 'error'>('preview');
  const [error, setError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutTicketResponse | null>(null);

  // Guardrail: validar activeActor
  if (!validateActiveActor(activeActor)) {
    devLog.warn('EventCheckoutModal: activeActor não válido');
    return null;
  }

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(safeNumber(cents, 0) / 100);
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

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Bloco 3.1: Usar apenas dados retornados pela API (não calcular split)
  const ticketPriceCents = safeNumber(event.ticket_price_cents, 0);
  const revenueSplit = safeArray(event.revenue_split, []);

  // Bloco 3.1: Apenas exibir porcentagens (não calcular valores)
  // Valores reais virão do backend após confirmação
  const getDistributionPreview = () => {
    if (revenueSplit.length === 0) {
      return null;
    }

    return revenueSplit.map((split: any) => {
      const targetType = split?.target_type;
      return {
        ...split,
        label: targetType === 'CULTURAL_PROFILE' 
          ? 'Artista / Organizador'
          : targetType === 'REGION'
          ? 'Região'
          : targetType === 'FUND'
          ? 'Fundo Regional'
          : 'Outro',
      };
    });
  };

  const distributionPreview = getDistributionPreview();

  // Bloco 3.2: Processar compra real via backend
  const handleConfirm = async () => {
    if (!validateActiveActor(activeActor)) {
      setError('Você precisa estar autenticado para comprar ingressos');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      const result = await safeApiCall(
        async () => checkoutTicket({
          eventId: event.id,
          idempotencyKey: `ticket_${event.id}_${activeActor!.actor_id}_${Date.now()}`,
          attendeeActorId: activeActor!.actor_id,
        }),
        null,
        'Erro ao processar compra'
      );

      if (!result || !result.success) {
        throw new Error((result as any)?.error || 'Erro ao processar compra');
      }

      setCheckoutResult(result);
      setStep('success');

      // Mostrar toast de sucesso
      showToast('Ingresso comprado com sucesso!', 'success');

      // Disparar eventos para atualizar feed
      window.dispatchEvent(new CustomEvent('impact-changed', {
        detail: {
          actor_id: activeActor!.actor_id,
          actor_type: activeActor!.actor_type,
        },
      }));

      window.dispatchEvent(new CustomEvent('ticket-purchased', {
        detail: {
          eventId: event.id,
          ticketId: result.ticketId,
        },
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar compra';
      setError(errorMessage);
      setStep('error');
      showToast('Erro ao comprar ingresso. Tente novamente.', 'error');
      devLog.error('Erro ao processar checkout de ingresso:', err);
    }
  };

  // Tela de sucesso - Bloco 3.2: Exibir impacto real
  if (step === 'success' && checkoutResult) {
    // Bloco 3.2: Usar dados reais retornados pela API (não calcular)
    // Se totalAmountCents não vier, usar ticketPriceCents como fallback
    const totalAmountCents = safeNumber(
      (checkoutResult as any).totalAmountCents,
      ticketPriceCents
    );
    
    // Campos opcionais de impacto (podem vir da API)
    const revenueEntry = (checkoutResult as any).revenueEntry ? {
      amount_cents: safeNumber((checkoutResult as any).revenueEntry.amountCents, 0),
      currency: safeString((checkoutResult as any).revenueEntry.currency, 'BRL'),
      recipient_actor_id: (checkoutResult as any).revenueEntry.recipientActorId || null,
    } : undefined;

    const profitShareEntry = (checkoutResult as any).profitShareEntry ? {
      amount_cents: safeNumber((checkoutResult as any).profitShareEntry.amountCents, 0),
      currency: safeString((checkoutResult as any).profitShareEntry.currency, 'BRL'),
      recipient_group_id: (checkoutResult as any).profitShareEntry.recipientGroupId || null,
    } : undefined;

    return (
      <div className="event-checkout-modal-overlay" onClick={onClose}>
        <div className="event-checkout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="event-checkout-success">
            <div className="success-icon">✓</div>
            <h2>Ingresso Comprado!</h2>
            <p>Seu ingresso foi adquirido com sucesso.</p>
            {checkoutResult.qrCode && (
              <div className="qr-code-preview">
                <p className="qr-code-label">Código QR:</p>
                <code className="qr-code-value">{checkoutResult.qrCode.substring(0, 20)}...</code>
              </div>
            )}
            
            {/* Bloco 3.2: Mini-resumo de impacto com dados reais */}
            {totalAmountCents > 0 && (
              <TransactionImpactSummary
                totalAmount={totalAmountCents}
                currency="BRL"
                revenueEntry={revenueEntry}
                profitShareEntry={profitShareEntry}
                onViewLedger={() => {
                  window.location.href = '/social/ledger';
                }}
                onBackToFeed={() => {
                  if (onSuccess && checkoutResult.ticketId && checkoutResult.qrCode) {
                    onSuccess(checkoutResult.ticketId, checkoutResult.qrCode);
                  }
                  onClose();
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-checkout-modal-overlay" onClick={onClose}>
      <div className="event-checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-checkout-modal-header">
          <h2>🎫 Comprar Ingresso</h2>
          <button className="event-checkout-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="event-checkout-modal-content">
          {/* Informações do evento */}
          <div className="event-checkout-info">
            <h3 className="event-checkout-title">{event.title}</h3>
            {event.description && (
              <p className="event-checkout-description">{event.description}</p>
            )}
            
            <div className="event-checkout-meta">
              <div className="event-checkout-meta-item">
                <span className="meta-icon">🗓️</span>
                <span className="meta-text">
                  {/* 🔴 F-WINDOW-RENDER-TRUTHFUL-EXTENT: evento que termina em OUTRO dia mostra a
                      data do fim, não só a hora — senão a tela afirma que acabou no mesmo dia.
                      Irmão do defeito achado em QuoteRequestDialog (2026-08-06). ⚠️ Hoje `events`
                      tem 0 linhas multi-dia: correção NÃO verificada visualmente, só logicamente. */}
                  {formatDate(event.datetime_start)}
                  {event.datetime_end && (
                    new Date(event.datetime_end).toDateString() === new Date(event.datetime_start).toDateString()
                      ? ` - ${formatTime(event.datetime_end)}`
                      : ` → ${formatDate(event.datetime_end)}`
                  )}
                </span>
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
          {ticketPriceCents > 0 && (
            <div className="event-checkout-price">
              <span className="price-label">Ingresso:</span>
              <span className="price-value">{formatPrice(ticketPriceCents)}</span>
            </div>
          )}

          {/* Distribuição do valor - Bloco 3.1: Preview baseado em dados da API (apenas porcentagens) */}
          {distributionPreview && distributionPreview.length > 0 && (
            <div className="event-checkout-distribution">
              <div className="distribution-label">Distribuição prévia:</div>
              <div className="distribution-list">
                {distributionPreview.map((item, idx) => (
                  <div key={idx} className="distribution-item">
                    <span className="distribution-target">{item.label}</span>
                    <span className="distribution-percentage">{item.percentage}%</span>
                  </div>
                ))}
              </div>
              <div className="distribution-note">
                <span className="note-icon">💡</span>
                <span className="note-text">
                  A distribuição será processada automaticamente pelo Split Engine após a confirmação.
                </span>
              </div>
            </div>
          )}

          {/* Nota sobre impacto */}
          <div className="event-checkout-impact-note">
            <span className="impact-icon">💚</span>
            <p className="impact-text">
              Esta compra gerará impacto social no ecossistema local.
            </p>
          </div>

          {/* Notas opcionais */}
          <div className="event-checkout-notes">
            <label htmlFor="event-checkout-notes">Observações (opcional):</label>
            <textarea
              id="event-checkout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione alguma observação sobre esta compra..."
              rows={3}
              disabled={step === 'processing'}
            />
          </div>

          {/* Erro - Bloco 3.2 */}
          {error && (
            <div className="event-checkout-error">
              <p>{error}</p>
              <button onClick={() => { setError(null); setStep('preview'); }}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <div className="event-checkout-modal-actions">
          <button
            className="event-checkout-modal-cancel"
            onClick={onClose}
            disabled={step === 'processing'}
          >
            Cancelar
          </button>
          <button
            className="event-checkout-modal-submit"
            onClick={handleConfirm}
            disabled={ticketPriceCents <= 0 || step === 'processing'}
          >
            {step === 'processing' ? 'Processando...' : 'Confirmar Compra'}
          </button>
        </div>
      </div>
    </div>
  );
}

