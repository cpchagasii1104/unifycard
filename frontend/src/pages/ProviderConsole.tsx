// frontend/src/pages/ProviderConsole.tsx
// App do Prestador: Inbox de Dispatch + Aceitar/Recusar + Presença

import { useState, useEffect } from 'react';
import { getServicePaymentHold } from '../api/marketplace';
import {
  updateProviderPresence,
  getProviderPresence,
  getProviderResponseSLAMetrics,
  getProviderDispatchInbox,
  getDispatchStatus,
  acceptServiceDispatch,
  declineServiceDispatch,
  expirePreReservations,
  createServiceEvaluation,
  getEvaluationWindow,
  getServiceEvaluationsByRequest,
} from '../api/marketplace';
import { checkBackendHealth } from '../api/health';
import type { ProviderPresence, DispatchInboxItem, DispatchStatus } from '../api/marketplace';
import './ProviderConsole.css';

// Componente para mostrar status de pagamento
function PaymentHoldStatus({ requestId }: { requestId: string }) {
  const [hold, setHold] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHold = async () => {
      try {
        const holdData = await getServicePaymentHold(requestId);
        setHold(holdData);
      } catch (err) {
        // Ignorar erro (pode não ter hold)
      } finally {
        setLoading(false);
      }
    };
    loadHold();
    const interval = setInterval(loadHold, 5000);
    return () => clearInterval(interval);
  }, [requestId]);

  if (loading || !hold) {
    return null;
  }

  return (
    <div className="payment-hold-status">
      {hold.status === 'held' && (
        <div className="payment-hold-badge held-provider">
          💰 Pagamento retido - Aguardando confirmação do cliente
        </div>
      )}
      {hold.status === 'released' && (
        <div className="payment-hold-badge released-provider">
          ✅ Pagamento liberado
        </div>
      )}
      {hold.status === 'disputed' && (
        <div className="payment-hold-badge disputed-provider">
          ⚠️ Em disputa
        </div>
      )}
    </div>
  );
}

export default function ProviderConsole() {
  const [providerActorId, setProviderActorId] = useState<string>('');
  const [presence, setPresence] = useState<ProviderPresence | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<any>(null);
  const [inbox, setInbox] = useState<DispatchInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchStatuses, setDispatchStatuses] = useState<Map<string, DispatchStatus>>(new Map());
  const [processingDispatch, setProcessingDispatch] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [evaluationWindows, setEvaluationWindows] = useState<Map<string, any>>(new Map());
  const [evaluations, setEvaluations] = useState<Map<string, any>>(new Map());

  // Verificar saúde do backend
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkBackendHealth();
        setBackendOnline(health?.status === 'ok');
      } catch (err) {
        setBackendOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // A cada 30s
    return () => clearInterval(interval);
  }, []);

  // Carregar presença e inbox quando providerActorId mudar
  useEffect(() => {
    if (!providerActorId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [presenceData, slaData, inboxData] = await Promise.all([
          getProviderPresence(providerActorId).catch(() => null),
          getProviderResponseSLAMetrics(providerActorId).catch(() => null),
          getProviderDispatchInbox(providerActorId).catch(() => ({ inbox: [] })),
        ]);

        setPresence(presenceData);
        setSlaMetrics(slaData);
        setInbox(inboxData.inbox);

        // Carregar status de cada dispatch
        const statusMap = new Map<string, DispatchStatus>();
        for (const item of inboxData.inbox) {
          try {
            const status = await getDispatchStatus(item.dispatch_id, providerActorId);
            statusMap.set(item.dispatch_id, status);
          } catch (err) {
            // Ignorar erros individuais
          }
        }
        setDispatchStatuses(statusMap);

        // Carregar janelas de avaliação e avaliações para cada request completado
        const completedRequests = inboxData.inbox.filter((item: any) => item.status === 'completed' || item.request_summary?.status === 'completed');
        const windowPromises = completedRequests.map((item: any) =>
          getEvaluationWindow(item.request_id)
            .then((window) => ({ requestId: item.request_id, window }))
            .catch(() => ({ requestId: item.request_id, window: null }))
        );
        const evaluationPromises = completedRequests.map((item: any) =>
          getServiceEvaluationsByRequest(item.request_id)
            .then((data) => ({ requestId: item.request_id, evaluations: data.evaluations }))
            .catch(() => ({ requestId: item.request_id, evaluations: [] }))
        );

        const [windows, evals] = await Promise.all([
          Promise.all(windowPromises),
          Promise.all(evaluationPromises),
        ]);

        const windowsEntries = windows
          .map((w: any) => [w.requestId, w.window] as [string, any])
          .filter(([, w]) => w != null);
        const windowsMap = new Map<string, any>(windowsEntries);
        const evalsMap = new Map<string, any>(evals.map((e: any) => [e.requestId, e.evaluations] as [string, any]));

        setEvaluationWindows(windowsMap);
        setEvaluations(evalsMap);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, [providerActorId]);

  const handleGoOnline = async () => {
    if (!providerActorId) {
      setError('ID do provider é obrigatório');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newPresence = await updateProviderPresence(providerActorId, {
        status: 'online',
        region: {
          country: 'BR',
          state: 'PR',
          city: 'Curitiba',
        },
      });
      setPresence(newPresence);
    } catch (err: any) {
      setError(err.message || 'Erro ao ficar online');
    } finally {
      setLoading(false);
    }
  };

  const handleGoOffline = async () => {
    if (!providerActorId) {
      setError('ID do provider é obrigatório');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newPresence = await updateProviderPresence(providerActorId, {
        status: 'offline',
        region: {
          country: 'BR',
          state: 'PR',
          city: 'Curitiba',
        },
      });
      setPresence(newPresence);
    } catch (err: any) {
      setError(err.message || 'Erro ao ficar offline');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDispatch = async (dispatchId: string) => {
    if (!providerActorId) {
      return;
    }

    setProcessingDispatch(dispatchId);
    setError(null);
    try {
      await acceptServiceDispatch(dispatchId, providerActorId);
      // Recarregar inbox
      const inboxData = await getProviderDispatchInbox(providerActorId);
      setInbox(inboxData.inbox);
    } catch (err: any) {
      setError(err.message || 'Erro ao aceitar dispatch');
    } finally {
      setProcessingDispatch(null);
    }
  };

  const handleDeclineDispatch = async (dispatchId: string) => {
    if (!providerActorId) {
      return;
    }

    setProcessingDispatch(dispatchId);
    setError(null);
    try {
      await declineServiceDispatch(dispatchId, providerActorId);
      // Recarregar inbox
      const inboxData = await getProviderDispatchInbox(providerActorId);
      setInbox(inboxData.inbox);
    } catch (err: any) {
      setError(err.message || 'Erro ao recusar dispatch');
    } finally {
      setProcessingDispatch(null);
    }
  };

  const handleExpirePreReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      await expirePreReservations();
      // Recarregar inbox
      if (providerActorId) {
        const inboxData = await getProviderDispatchInbox(providerActorId);
        setInbox(inboxData.inbox);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao expirar pré-reservas');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Expirado';
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="provider-console">
      <h1>Console do Prestador</h1>

      {!backendOnline && (
        <div className="backend-offline">
          ⚠️ Backend offline. Algumas funcionalidades podem não estar disponíveis.
        </div>
      )}

      <div className="provider-setup">
        <label>
          Provider Actor ID:
          <input
            type="text"
            value={providerActorId}
            onChange={(e) => setProviderActorId(e.target.value)}
            placeholder="Ex: store-001"
          />
        </label>
      </div>

      {providerActorId && (
        <>
          <div className="presence-controls">
            <h2>Presença</h2>
            <div className="presence-status">
              Status: <strong>{presence?.status || 'offline'}</strong>
              {presence?.last_seen && (
                <span> (última vez: {new Date(presence.last_seen).toLocaleString()})</span>
              )}
            </div>
            <div className="presence-buttons">
              <button onClick={handleGoOnline} disabled={loading || presence?.status === 'online'}>
                Ficar Online
              </button>
              <button onClick={handleGoOffline} disabled={loading || presence?.status === 'offline'}>
                Ficar Offline
              </button>
            </div>
          </div>

          {slaMetrics && (
            <div className="sla-metrics">
              <h2>Métricas de SLA</h2>
              <div className="metrics-grid">
                <div>
                  <strong>Tempo médio de resposta:</strong> {slaMetrics.average_response_time_minutes.toFixed(1)} min
                </div>
                <div>
                  <strong>Taxa de aceitação:</strong> {slaMetrics.acceptance_rate.toFixed(1)}%
                </div>
                <div>
                  <strong>Total recebidos:</strong> {slaMetrics.total_dispatches_received}
                </div>
                <div>
                  <strong>Total aceitos:</strong> {slaMetrics.total_dispatches_accepted}
                </div>
                <div>
                  <strong>Total recusados:</strong> {slaMetrics.total_dispatches_declined}
                </div>
              </div>
            </div>
          )}

          <div className="inbox-section">
            <div className="inbox-header">
              <h2>Inbox de Dispatches ({inbox.length})</h2>
              <button onClick={handleExpirePreReservations} disabled={loading} className="expire-button">
                Rodar Expiração (Dev)
              </button>
            </div>

            {loading && <div>Carregando...</div>}
            {error && <div className="error">{error}</div>}

            {inbox.length === 0 ? (
              <div className="empty-inbox">Nenhum dispatch pendente</div>
            ) : (
              <div className="dispatch-cards">
                {inbox.map((item) => {
                  const status = dispatchStatuses.get(item.dispatch_id);
                  const isExpired = status?.pre_reservation_status === 'expired' || 
                    (item.pre_reservation && new Date(item.pre_reservation.expires_at) < new Date());
                  const isAccepted = item.status === 'accepted' || status?.already_accepted;
                  const isProcessing = processingDispatch === item.dispatch_id;

                  return (
                    <div key={item.dispatch_id} className={`dispatch-card ${isExpired ? 'expired' : ''} ${isAccepted ? 'accepted' : ''}`}>
                      <div className="dispatch-header">
                        <h3>
                          {item.request_summary.intent === 'now' && '🟢 Agora'}
                          {item.request_summary.intent === 'scheduled' && '📅 Agendado'}
                          {item.request_summary.intent === 'bundle' && '📦 Combo'}
                        </h3>
                        <span className="dispatch-status">{item.status}</span>
                      </div>

                      <div className="dispatch-content">
                        <div>
                          <strong>Serviços:</strong>{' '}
                          {item.request_summary.service_items.map((si, idx) => (
                            <span key={idx}>
                              {si.quantity}x {si.offering_id}
                              {idx < item.request_summary.service_items.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                        <div>
                          <strong>Local:</strong> {item.request_summary.neighborhood || item.request_summary.city}
                          {item.request_summary.neighborhood && `, ${item.request_summary.city}`}
                        </div>
                        {item.request_summary.schedule.date && (
                          <div>
                            <strong>Data/Hora:</strong> {item.request_summary.schedule.date}{' '}
                            {item.request_summary.schedule.time}
                          </div>
                        )}
                        {item.pre_reservation && (
                          <div className="pre-reservation-info">
                            <strong>Pré-reserva:</strong> {item.pre_reservation.date} {item.pre_reservation.time}
                            <br />
                            <strong>Tempo restante:</strong>{' '}
                            <span className={isExpired ? 'expired' : ''}>
                              {formatTimeRemaining(item.pre_reservation.expires_at)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="dispatch-actions">
                        {isAccepted ? (
                          <div className="accepted-message">
                            ✓ Aceito{status?.accepted_by && ` por ${status.accepted_by}`}
                          </div>
                        ) : isExpired ? (
                          <div className="expired-message">⏱️ Expirado</div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleAcceptDispatch(item.dispatch_id)}
                              disabled={isProcessing || isAccepted}
                              className="accept-button"
                            >
                              {isProcessing ? 'Processando...' : 'Aceitar'}
                            </button>
                            <button
                              onClick={() => handleDeclineDispatch(item.dispatch_id)}
                              disabled={isProcessing || isAccepted}
                              className="decline-button"
                            >
                              Recusar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

