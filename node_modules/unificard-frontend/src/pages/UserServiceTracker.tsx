// frontend/src/pages/UserServiceTracker.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Detail Page (read-only)
// Visualização focada em UMA requisição de serviço (read-only)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getServiceRequestTimeline,
  getServiceRequestStatus,
  getServicePaymentHold,
  getEvaluationWindow,
  getServiceEvaluationsByRequest,
} from '../api/marketplace';
import { checkBackendHealth } from '../api/health';
import type {
  ServiceRequestTimelineEvent,
  ServiceRequestStatus,
  ServicePaymentHold,
} from '../api/marketplace';
import './UserServiceTracker.css';

export default function UserServiceTracker() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<ServiceRequestTimelineEvent[]>([]);
  const [status, setStatus] = useState<ServiceRequestStatus | null>(null);
  const [paymentHold, setPaymentHold] = useState<ServicePaymentHold | null>(null);
  const [evaluationWindow, setEvaluationWindow] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);

  // Verificar saúde do backend
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkBackendHealth();
        setBackendOnline(health.status === 'ok');
      } catch (err) {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // A cada 30s
    return () => clearInterval(interval);
  }, []);

  // Carregar timeline e status
  useEffect(() => {
    if (!requestId) {
      setError('ID da requisição não fornecido');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [timelineData, statusData, holdData, windowData, evaluationsData] = await Promise.all([
          getServiceRequestTimeline(requestId).catch(() => ({ timeline: [] })),
          getServiceRequestStatus(requestId).catch(() => null),
          getServicePaymentHold(requestId).catch(() => null),
          getEvaluationWindow(requestId).catch(() => null),
          getServiceEvaluationsByRequest(requestId).catch(() => ({ evaluations: [] })),
        ]);

        setTimeline(timelineData.timeline);
        setStatus(statusData);
        setPaymentHold(holdData);
        setEvaluationWindow(windowData);
        setEvaluations(evaluationsData.evaluations);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do serviço');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, [requestId]);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'searching':
        return 'Procurando prestador';
      case 'waiting_provider':
        return 'Aguardando resposta';
      case 'confirmed':
        return 'Prestador confirmado';
      case 'in_progress':
        return 'Em atendimento';
      case 'completed':
        return 'Concluído';
      case 'expired':
        return 'Expirado / não atendido';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'searching':
        return '#ffc107';
      case 'waiting_provider':
        return '#17a2b8';
      case 'confirmed':
        return '#28a745';
      case 'in_progress':
        return '#007bff';
      case 'completed':
        return '#28a745';
      case 'expired':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getEventLabel = (event: ServiceRequestTimelineEvent): string => {
    switch (event.type) {
      case 'service_request_created':
        return 'Solicitação criada';
      case 'service_dispatch_sent':
        return `Dispatch enviado para ${event.payload?.candidates_count || 0} prestador(es)`;
      case 'service_pre_reservation_created':
        return 'Pré-reserva criada';
      case 'service_pre_reservation_expired':
        return 'Pré-reserva expirada';
      case 'service_pre_reservation_confirmed':
        return 'Pré-reserva confirmada';
      case 'service_dispatch_declined':
        return 'Dispatch recusado';
      case 'service_dispatch_accepted':
        return 'Dispatch aceito';
      case 'service_booking_confirmed':
        return 'Agendamento confirmado';
      case 'order_created':
        return 'Pedido criado';
      case 'order_paid':
        return 'Pedido pago';
      case 'service_request_expired':
        return 'Solicitação expirada';
      case 'service_completed':
        return 'Serviço concluído';
      default:
        return event.type;
    }
  };

  const getEventIcon = (event: ServiceRequestTimelineEvent): string => {
    switch (event.type) {
      case 'service_request_created':
        return '📝';
      case 'service_dispatch_sent':
        return '📤';
      case 'service_pre_reservation_created':
        return '⏳';
      case 'service_pre_reservation_expired':
        return '⏱️';
      case 'service_pre_reservation_confirmed':
        return '✅';
      case 'service_dispatch_declined':
        return '❌';
      case 'service_dispatch_accepted':
        return '✅';
      case 'service_booking_confirmed':
        return '📅';
      case 'order_created':
        return '🛒';
      case 'order_paid':
        return '💳';
      case 'service_request_expired':
        return '⏱️';
      case 'service_completed':
        return '🎉';
      default:
        return '📌';
    }
  };

  if (!backendOnline) {
    return (
      <div className="user-service-tracker">
        <div className="backend-offline">
          ⚠️ Backend offline. Algumas funcionalidades podem não estar disponíveis.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-service-tracker">
        <div className="loading">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-service-tracker">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="user-service-tracker">
        <div className="error">Requisição não encontrada</div>
      </div>
    );
  }

  return (
    <div className="user-service-tracker">
      <h1>Acompanhamento de Serviço</h1>

      {/* Header: Resumo do serviço */}
      <div className="service-summary">
        <div className="service-summary-header">
          <h2>Resumo do Serviço</h2>
          <div
            className="status-badge"
            style={{ backgroundColor: getStatusColor(status.status) }}
          >
            {getStatusLabel(status.status)}
          </div>
        </div>

        <div className="service-summary-content">
          <div>
            <strong>Intenção:</strong>{' '}
            {status.intent === 'now' && '🟢 Agora'}
            {status.intent === 'scheduled' && '📅 Agendado'}
            {status.intent === 'bundle' && '📦 Combo'}
          </div>
          <div>
            <strong>Local:</strong> {status.neighborhood || status.city}
            {status.neighborhood && `, ${status.city}`}
          </div>
          {status.confirmed_schedule && (
            <div>
              <strong>Data/Hora confirmada:</strong> {status.confirmed_schedule.date}{' '}
              {status.confirmed_schedule.time}
            </div>
          )}
          <div>
            <strong>Serviços:</strong>{' '}
            {status.service_items.map((item, idx) => (
              <span key={idx}>
                {item.quantity}x {item.offering_id}
                {idx < status.service_items.length - 1 && ', '}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Provider confirmado */}
      {status.provider && (
        <div className="provider-info">
          <h3>Prestador Confirmado</h3>
          <div>
            <strong>ID:</strong> {status.provider.provider_actor_id}
          </div>
          <div>
            <strong>Confirmado em:</strong>{' '}
            {new Date(status.provider.confirmed_at).toLocaleString()}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="timeline-section">
        <h3>Timeline</h3>
        {timeline.length === 0 ? (
          <div className="empty-timeline">Nenhum evento registrado ainda.</div>
        ) : (
          <div className="timeline">
            {timeline.map((event, idx) => (
              <div key={idx} className="timeline-event">
                <div className="timeline-icon">{getEventIcon(event)}</div>
                <div className="timeline-content">
                  <div className="timeline-event-type">{getEventLabel(event)}</div>
                  <div className="timeline-event-time">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                  {event.actor_id && (
                    <div className="timeline-event-actor">
                      <strong>Actor:</strong> {event.actor_id}
                    </div>
                  )}
                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <div className="timeline-event-payload">
                      {JSON.stringify(event.payload, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔴 ENTITY DETAIL PAGE: CTAs explícitos para navegar para Action Pages dedicadas */}
      {status.status === 'in_progress' && status.provider && (
        <div className="action-section">
          <button
            className="complete-button"
            onClick={() => navigate(`/service-requests/${requestId}/complete`)}
          >
            Marcar como Concluído
          </button>
        </div>
      )}

      {/* 🔴 ENTITY DETAIL PAGE: CTA explícito para navegar para Action Page (avaliação) */}
      {status.status === 'completed' && evaluationWindow && !evaluationWindow.user_evaluated && !evaluationWindow.is_expired && (
        <div className="evaluation-section">
          <h3>⭐ Avalie o Serviço</h3>
          <p className="evaluation-explanation">
            Sua avaliação melhora o ecossistema e ajuda outros usuários a encontrarem bons prestadores.
          </p>
          {evaluationWindow.expires_at && (
            <p className="evaluation-deadline">
              ⏰ Prazo para avaliar: {new Date(evaluationWindow.expires_at).toLocaleString()}
            </p>
          )}
          <button
            className="submit-evaluation-button"
            onClick={() => navigate(`/service-requests/${requestId}/evaluate`)}
          >
            Avaliar Serviço
          </button>
        </div>
      )}

      {status.status === 'completed' && evaluationWindow && evaluationWindow.user_evaluated && (
        <div className="evaluation-section">
          <h3>✅ Avaliação Enviada</h3>
          <p>Obrigado por avaliar o serviço! Sua avaliação ajuda a melhorar o ecossistema.</p>
        </div>
      )}
    </div>
  );
}

