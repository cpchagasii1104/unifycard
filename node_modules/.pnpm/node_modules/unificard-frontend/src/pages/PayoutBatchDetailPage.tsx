// frontend/src/pages/PayoutBatchDetailPage.tsx
// Página de Detalhes do Payout Batch
// 🔴 BLINDAGEM: Frontend apenas reflete backend

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPayoutBatch, listPayoutOrders, type PayoutBatch, type PayoutOrder } from '../api/payouts';
import PayoutOrderPanel from '../components/payout/PayoutOrderPanel';
import './PayoutBatchDetailPage.css';

export default function PayoutBatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<PayoutBatch | null>(null);
  const [orders, setOrders] = useState<PayoutOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (batchId) {
      loadBatchData();
    }
  }, [batchId]);

  const loadBatchData = async () => {
    if (!batchId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [batchData, ordersData] = await Promise.all([
        getPayoutBatch(batchId),
        listPayoutOrders({ batchId, limit: 1000 }),
      ]);
      setBatch(batchData);
      setOrders(ordersData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar batch');
      console.error('Erro ao carregar batch:', err);
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

  const formatDate = (dateString: string) => {
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

  if (isLoading) {
    return (
      <div className="payout-batch-detail">
        <div className="payout-loading">Carregando batch...</div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="payout-batch-detail">
        <div className="payout-error">{error || 'Batch não encontrado'}</div>
      </div>
    );
  }

  const readyOrders = orders.filter((o) => o.status === 'READY');
  const blockedOrders = orders.filter((o) => o.status === 'BLOCKED');
  const executedOrders = orders.filter((o) => o.status === 'EXECUTED');
  const failedOrders = orders.filter((o) => o.status === 'FAILED');

  return (
    <div className="payout-batch-detail">
      <div className="batch-detail-header">
        <button className="btn-secondary btn-sm" onClick={() => navigate('/payouts')}>
          ← Voltar
        </button>
        <h1>Payout Batch: {batch.batchId.substring(0, 8)}...</h1>
      </div>

      <div className="batch-summary">
        <div className="summary-card">
          <div className="summary-label">Status</div>
          <div className={`summary-value status-badge ${getStatusBadgeClass(batch.status)}`}>
            {getStatusLabel(batch.status)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total</div>
          <div className="summary-value">{formatPrice(batch.totalAmountCents, batch.currency)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total de Orders</div>
          <div className="summary-value">{batch.orderCount}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Prontos</div>
          <div className="summary-value success-value">{readyOrders.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Bloqueados</div>
          <div className="summary-value blocked-value">{blockedOrders.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Executados</div>
          <div className="summary-value">{executedOrders.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Falhas</div>
          <div className="summary-value failed-value">{failedOrders.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Criado em</div>
          <div className="summary-value">{formatDate(batch.createdAt)}</div>
        </div>
      </div>

      <div className="batch-orders-section">
        <h2>Payout Orders ({orders.length})</h2>
        <div className="orders-list">
          {orders.length === 0 ? (
            <div className="payout-empty">Nenhum order encontrado.</div>
          ) : (
            orders.map((order) => (
              <div
                key={order.orderId}
                className={`order-item order-item-${order.status.toLowerCase()}`}
                onClick={() => setSelectedOrderId(order.orderId)}
              >
                <div className="order-item-header">
                  <div className="order-actor">{order.actorId}</div>
                  <div className={`order-status status-badge ${getStatusBadgeClass(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </div>
                </div>
                <div className="order-item-body">
                  <div className="order-amount">{formatPrice(order.amountCents, order.currency)}</div>
                  {order.blockReason && (
                    <div className="order-block-reason">⚠️ {order.blockReason}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedOrderId && (
        <PayoutOrderPanel
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={loadBatchData}
        />
      )}
    </div>
  );
}




