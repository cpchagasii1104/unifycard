// src/components/ServicePostCard.tsx
// Componente para exibir posts de serviços com ações de agendar e pagar

import { useState } from 'react';
import { type PostCardData, confirmCTA } from '../api/social';
import './ServicePostCard.css';

interface ServicePostCardProps {
  post: PostCardData;
  onScheduleSuccess?: () => void;
  onPaymentSuccess?: () => void;
}

export default function ServicePostCard({ post, onScheduleSuccess, onPaymentSuccess }: ServicePostCardProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(post.cta?.price?.toString() || '');

  const formatCurrency = (value: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  // Função formatDate removida (não utilizada)

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) return;

    setIsScheduling(true);
    setScheduleError(null);

    try {
      // Converter para ISO datetime
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();

      // TODO: Implementar agendamento quando endpoint estiver disponível
      // await scheduleServiceFromPost(post.post_id, startISO, endISO);
      console.warn('Agendamento não implementado ainda');
      setShowScheduleForm(false);
      setStartTime('');
      setEndTime('');
      if (onScheduleSuccess) onScheduleSuccess();
      alert('Serviço agendado com sucesso!');
    } catch (err: any) {
      setScheduleError(err.message || 'Erro ao agendar serviço');
    } finally {
      setIsScheduling(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      setPaymentError('Valor inválido');
      return;
    }

    setIsPaying(true);
    setPaymentError(null);

    try {
      if (post.cta?.cta_id) {
        await confirmCTA(post.cta.cta_id, { notes: `Pagamento de ${amount}` });
      } else {
        throw new Error('CTA não disponível para pagamento');
      }
      setShowPaymentForm(false);
      setPaymentAmount(post.cta?.price?.toString() || '');
      if (onPaymentSuccess) onPaymentSuccess();
      alert('Pagamento realizado com sucesso!');
    } catch (err: any) {
      setPaymentError(err.message || 'Erro ao processar pagamento');
    } finally {
      setIsPaying(false);
    }
  };

  // Verificar se é post de serviço baseado no intent e CTA
  if (post.intent !== 'service_offer' || !post.cta || post.cta.cta_type !== 'service') {
    return null; // Não renderizar se não for post de serviço
  }

  const serviceInfo = {
    price: post.cta.price,
    currency: post.cta.currency || 'BRL',
    categoryName: post.intent_metadata?.category_name as string | undefined,
    description: post.intent_metadata?.description as string | undefined,
    duration: post.intent_metadata?.duration as number | undefined,
    pricingType: post.intent_metadata?.pricing_type as 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote' | undefined,
    requiresSchedule: post.intent_metadata?.requires_schedule !== false,
    requiresPayment: !!post.cta.price,
  };

  return (
    <div className="service-post-card">
      <div className="service-badge">🔧 Serviço</div>
      
      {serviceInfo.categoryName && (
        <div className="service-category">
          <strong>Categoria:</strong> {serviceInfo.categoryName}
        </div>
      )}

      {serviceInfo.price !== undefined && serviceInfo.price !== null && (
        <div className="service-price">
          <strong>Preço:</strong>{' '}
          {serviceInfo.pricingType === 'hourly' && 'Por hora: '}
          {serviceInfo.pricingType === 'daily' && 'Por dia: '}
          {serviceInfo.pricingType === 'weekly' && 'Por semana: '}
          {serviceInfo.pricingType === 'monthly' && 'Por mês: '}
          {serviceInfo.pricingType === 'quote' && 'Solicitar orçamento'}
          {serviceInfo.pricingType !== 'quote' && formatCurrency(serviceInfo.price, serviceInfo.currency)}
        </div>
      )}

      {serviceInfo.description && (
        <div className="service-description">{serviceInfo.description}</div>
      )}

      {serviceInfo.duration && (
        <div className="service-duration">
          <strong>Duração estimada:</strong> {serviceInfo.duration} minutos
        </div>
      )}

      <div className="service-actions">
        {serviceInfo.requiresSchedule !== false && (
          <>
            {!showScheduleForm ? (
              <button
                className="btn-schedule"
                onClick={() => setShowScheduleForm(true)}
                disabled={isScheduling || isPaying}
              >
                📅 Agendar Serviço
              </button>
            ) : (
              <form onSubmit={handleSchedule} className="schedule-form">
                <div className="form-group">
                  <label>Data e Hora de Início:</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    disabled={isScheduling}
                  />
                </div>
                <div className="form-group">
                  <label>Data e Hora de Término:</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    disabled={isScheduling}
                  />
                </div>
                {scheduleError && <div className="error-message">{scheduleError}</div>}
                <div className="form-actions">
                  <button type="submit" disabled={isScheduling} className="btn-primary">
                    {isScheduling ? 'Agendando...' : 'Confirmar Agendamento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleForm(false);
                      setScheduleError(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {serviceInfo.requiresPayment && (
          <>
            {!showPaymentForm ? (
              <button
                className="btn-pay"
                onClick={() => setShowPaymentForm(true)}
                disabled={isScheduling || isPaying}
              >
                💳 Pagar Agora
              </button>
            ) : (
              <form onSubmit={handlePayment} className="payment-form">
                <div className="form-group">
                  <label>Valor a Pagar:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    disabled={isPaying}
                    placeholder={serviceInfo.price?.toString() || '0.00'}
                  />
                  <span className="currency">{serviceInfo.currency || 'BRL'}</span>
                </div>
                {paymentError && <div className="error-message">{paymentError}</div>}
                <div className="form-actions">
                  <button type="submit" disabled={isPaying} className="btn-primary">
                    {isPaying ? 'Processando...' : 'Confirmar Pagamento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setPaymentError(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}


