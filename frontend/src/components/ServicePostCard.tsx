// src/components/ServicePostCard.tsx
// Componente para exibir posts de serviços com ações de agendar e pagar

import { useState } from 'react';
import { type PostCardData } from '../api/social';
import { normalizeCategoryLabel } from '../utils/categoryLabelNormalizer';
import BlockedButton from './common/BlockedButton';
import './ServicePostCard.css';

interface ServicePostCardProps {
  post: PostCardData;
  onScheduleSuccess?: () => void;
  onPaymentSuccess?: () => void;
}

export default function ServicePostCard({ post, onScheduleSuccess, onPaymentSuccess }: ServicePostCardProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

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
      // 🔴 BLINDAGEM: Booking é domínio, não feed
      // ServicePostCard deve delegar para ação BOOK do plugin quando disponível
      // Por enquanto, manter implementação legada para compatibilidade
      // 🔴 PÓS-MVP: Migrar para usar FeedServiceItem com ação BOOK do plugin
      
      // Converter para ISO datetime
      // const startISO = new Date(startTime).toISOString();
      // const endISO = new Date(endTime).toISOString();

      // 🔴 NOTA: Agendamento deve ser feito via domínio de services/booking
      // Este componente será substituído por FeedServiceItem que usa ações do plugin
      // 🔴 B2 / F-OFFER: PLACEBO REMOVIDO. Este card NÃO cria booking — declarar "agendado com sucesso"
      // sem chamar a API era verdade falsa (frontend nunca cria verdade). A reserva real acontece pela
      // jornada canônica discovery → oferta → disponibilidade → reserva (ServiceOfferingSelector).
      setShowScheduleForm(false);
      setStartTime('');
      setEndTime('');
      setScheduleError('Agendamento por este card foi descontinuado — abra a página do serviço para reservar uma oferta.');
    } catch (err: any) {
      setScheduleError(err.message || 'Erro ao agendar serviço');
    } finally {
      setIsScheduling(false);
    }
  };

  // 🔴 F-HANDLEPAYMENT (A+D): handlePayment REMOVIDO. Chamava confirmCTA (NOT_IMPLEMENTED) e tinha um
  // alert('Pagamento realizado com sucesso!') morto/latente — o frontend nunca cria verdade financeira.
  // Pagamento por card NÃO existe; dinheiro real está em HOLD. UI honesta abaixo (BlockedButton).

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
          <strong>Categoria:</strong> {normalizeCategoryLabel(serviceInfo.categoryName)}
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
                disabled={isScheduling}
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
          <div className="payment-unavailable">
            {/* 🔴 F-HANDLEPAYMENT (A+D): pagamento por card NÃO existe e dinheiro real está em HOLD.
                Sem fake-success, sem formulário enganoso — estado honesto reusando BlockedButton. */}
            <BlockedButton
              className="btn-pay"
              reason="Fluxo financeiro em desenvolvimento. A reserva acontece pela página do serviço (descoberta → oferta → disponibilidade)."
            >
              💳 Pagamento indisponível nesta versão
            </BlockedButton>
          </div>
        )}
      </div>
    </div>
  );
}










