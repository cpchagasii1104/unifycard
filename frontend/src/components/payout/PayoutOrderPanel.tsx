// frontend/src/components/payout/PayoutOrderPanel.tsx
// Painel de Detalhes do Payout Order
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import { getPayoutOrder, executePayoutManual, markPayoutAsFailed, type PayoutOrder, type ExecutePayoutManualInput, type FailPayoutInput } from '../../api/payouts';
import { getTrustProfile, type TrustProfile } from '../../api/trust';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../../utils/toast';
import PayoutExecuteModal from './PayoutExecuteModal';
import PayoutFailModal from './PayoutFailModal';
import InvoiceLink from '../invoicing/InvoiceLink';
import './PayoutOrderPanel.css';

interface PayoutOrderPanelProps {
  orderId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function PayoutOrderPanel({ orderId, onClose, onUpdated }: PayoutOrderPanelProps) {
  const { activeActor } = useActiveActor();
  const [order, setOrder] = useState<PayoutOrder | null>(null);
  const [trustProfile, setTrustProfile] = useState<TrustProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);

  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  const loadOrderData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getPayoutOrder(orderId);
      setOrder(orderData);

      // Carregar trust profile
      try {
        const profile = await getTrustProfile(orderData.actorId);
        setTrustProfile(profile);
      } catch (err) {
        console.warn('Erro ao carregar trust profile:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar order');
      console.error('Erro ao carregar order:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async (input: ExecutePayoutManualInput) => {
    if (!activeActor) {
      showToast('Actor não encontrado', 'error');
      return;
    }

    try {
      const updated = await executePayoutManual(orderId, {
        ...input,
        executedByActorId: activeActor.actor_id,
      });
      setOrder(updated);
      setShowExecuteModal(false);
      showToast('Payout executado com sucesso', 'success');
      if (onUpdated) {
        onUpdated();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao executar payout', 'error');
    }
  };

  const handleFail = async (input: FailPayoutInput) => {
    if (!activeActor) {
      showToast('Actor não encontrado', 'error');
      return;
    }

    try {
      const updated = await markPayoutAsFailed(orderId, {
        ...input,
        failedByActorId: activeActor.actor_id,
      });
      setOrder(updated);
      setShowFailModal(false);
      showToast('Payout marcado como falho', 'success');
      if (onUpdated) {
        onUpdated();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao marcar payout como falho', 'error');
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      PENDING: 'status-pending',
      READY: 'status-ready',
      BLOCKED: 'status-blocked',
      EXECUTED: 'status-executed',
      FAILED: 'status-failed',
    };
    return classes[status] || 'status-default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Pendente',
      READY: 'Pronto',
      BLOCKED: 'Bloqueado',
      EXECUTED: 'Executado',
      FAILED: 'Falhou',
    };
    return labels[status] || status;
  };

  const getRiskLevelLabel = (riskLevel: string) => {
    const labels: Record<string, string> = {
      LOW: 'Baixo',
      MEDIUM: 'Médio',
      HIGH: 'Alto',
      BLOCKED: 'Bloqueado',
    };
    return labels[riskLevel] || riskLevel;
  };

  if (isLoading) {
    return (
      <div className="payout-order-panel-overlay" onClick={onClose}>
        <div className="payout-order-panel" onClick={(e) => e.stopPropagation()}>
          <div className="payout-loading">Carregando order...</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="payout-order-panel-overlay" onClick={onClose}>
        <div className="payout-order-panel" onClick={(e) => e.stopPropagation()}>
          <div className="payout-error">{error || 'Order não encontrado'}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="payout-order-panel-overlay" onClick={onClose}>
        <div className="payout-order-panel" onClick={(e) => e.stopPropagation()}>
          <div className="panel-header">
            <h2>Payout Order: {order.orderId.substring(0, 8)}...</h2>
            <button className="panel-close" onClick={onClose}>×</button>
          </div>

          <div className="panel-content">
            {/* Status e Valor */}
            <div className="panel-section">
              <h3>Status e Valor</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Status:</label>
                  <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                <div className="info-item">
                  <label>Valor:</label>
                  <span className="info-value">{formatPrice(order.amountCents, order.currency)}</span>
                </div>
                <div className="info-item">
                  <label>Método:</label>
                  <span className="info-value">{order.payoutMethod}</span>
                </div>
              </div>
            </div>

            {/* Beneficiário */}
            <div className="panel-section">
              <h3>Beneficiário</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Actor ID:</label>
                  <span className="info-value monospace">{order.actorId}</span>
                </div>
                {trustProfile && (
                  <>
                    <div className="info-item">
                      <label>Trust Score:</label>
                      <span className="info-value">{trustProfile.currentScore}/100</span>
                    </div>
                    <div className="info-item">
                      <label>Risk Level:</label>
                      <span className={`info-value risk-${trustProfile.riskLevel.toLowerCase()}`}>
                        {getRiskLevelLabel(trustProfile.riskLevel)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bloqueio */}
            {order.status === 'BLOCKED' && order.blockReason && (
              <div className="panel-section panel-warning">
                <h3>⚠️ Motivo do Bloqueio</h3>
                <p className="block-reason">{order.blockReason}</p>
              </div>
            )}

            {/* Referências */}
            <div className="panel-section">
              <h3>Referências</h3>
              <div className="info-grid">
                {order.escrowId && (
                  <div className="info-item">
                    <label>Escrow ID:</label>
                    <span className="info-value monospace">{order.escrowId.substring(0, 8)}...</span>
                  </div>
                )}
                {order.agreementId && (
                  <div className="info-item">
                    <label>Agreement ID:</label>
                    <span className="info-value monospace">{order.agreementId.substring(0, 8)}...</span>
                  </div>
                )}
                <div className="info-item">
                  <label>Ledger Entries:</label>
                  <span className="info-value">{order.ledgerEntryIds.length} entrada(s)</span>
                </div>
                <div className="info-item">
                  <label>Evidence Pack:</label>
                  <a
                    href={`/evidence/${order.evidencePackId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="info-link"
                  >
                    Ver Evidence Pack
                  </a>
                </div>
                {order.status === 'EXECUTED' && (
                  <div className="info-item">
                    <label>Invoice:</label>
                    <InvoiceLink payoutOrderId={order.orderId} />
                  </div>
                )}
              </div>
            </div>

            {/* Histórico */}
            <div className="panel-section">
              <h3>Histórico</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Criado em:</label>
                  <span className="info-value">{formatDate(order.createdAt)}</span>
                </div>
                {order.executedAt && (
                  <div className="info-item">
                    <label>Executado em:</label>
                    <span className="info-value">{formatDate(order.executedAt)}</span>
                  </div>
                )}
                {order.failedAt && (
                  <div className="info-item">
                    <label>Falhou em:</label>
                    <span className="info-value">{formatDate(order.failedAt)}</span>
                  </div>
                )}
                {order.failureReason && (
                  <div className="info-item">
                    <label>Motivo da Falha:</label>
                    <span className="info-value">{order.failureReason}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações */}
            {order.status === 'READY' && (
              <div className="panel-actions">
                <button
                  className="btn-primary"
                  onClick={() => setShowExecuteModal(true)}
                  disabled={!activeActor}
                >
                  Executar Pagamento (Manual)
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowFailModal(true)}
                  disabled={!activeActor}
                >
                  Marcar como Falho
                </button>
              </div>
            )}

            {order.status === 'EXECUTED' && order.executionMetadata && (
              <div className="panel-section">
                <h3>Dados de Execução</h3>
                <pre className="execution-metadata">
                  {JSON.stringify(order.executionMetadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Aviso Legal */}
            <div className="panel-legal-notice">
              <p>
                <strong>Aviso Legal:</strong> A execução confirma pagamento fora da plataforma.
                Esta ação é registrada e não reversível. Certifique-se de que o pagamento foi
                efetivamente realizado antes de confirmar.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showExecuteModal && order && (
        <PayoutExecuteModal
          order={order}
          onClose={() => setShowExecuteModal(false)}
          onExecute={handleExecute}
        />
      )}

      {showFailModal && order && (
        <PayoutFailModal
          order={order}
          onClose={() => setShowFailModal(false)}
          onFail={handleFail}
        />
      )}
    </>
  );
}

