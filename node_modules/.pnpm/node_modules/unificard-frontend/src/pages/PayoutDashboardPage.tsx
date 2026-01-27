// frontend/src/pages/PayoutDashboardPage.tsx
// Dashboard de Payout Management (Admin/Finance)
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPayoutBatches, createPayoutBatch, type PayoutBatch, type CreatePayoutBatchInput } from '../api/payouts';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../utils/toast';
import './PayoutDashboardPage.css';

export default function PayoutDashboardPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    status?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadBatches();
  }, [filters]);

  const loadBatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listPayoutBatches({
        status: filters.status as any,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 100,
      });
      setBatches(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar batches');
      console.error('Erro ao carregar batches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBatch = async (input: CreatePayoutBatchInput) => {
    if (!activeActor) {
      showToast('Actor não encontrado', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createPayoutBatch(input);
      showToast(`Batch criado com ${result.orders.length} orders`, 'success');
      setShowCreateModal(false);
      await loadBatches();
      // Navegar para detalhes do batch
      navigate(`/payouts/batches/${result.batch.batchId}`);
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar batch', 'error');
    } finally {
      setIsCreating(false);
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
      <div className="payout-dashboard">
        <div className="payout-loading">Carregando batches...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payout-dashboard">
        <div className="payout-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="payout-dashboard">
      <div className="payout-dashboard-header">
        <h1>Payout Management</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={!activeActor}
        >
          Criar Novo Batch
        </button>
      </div>

      <div className="payout-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="READY">Pronto</option>
            <option value="BLOCKED">Bloqueado</option>
            <option value="EXECUTED">Executado</option>
            <option value="FAILED">Falhou</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Data Início:</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
          />
        </div>
        <div className="filter-group">
          <label>Data Fim:</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
          />
        </div>
      </div>

      <div className="payout-batches-list">
        {batches.length === 0 ? (
          <div className="payout-empty">Nenhum batch encontrado.</div>
        ) : (
          <table className="payout-batches-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Status</th>
                <th>Total</th>
                <th>Orders</th>
                <th>Executados</th>
                <th>Bloqueados</th>
                <th>Falhas</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.batchId}>
                  <td className="batch-id-cell">{batch.batchId.substring(0, 8)}...</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(batch.status)}`}>
                      {getStatusLabel(batch.status)}
                    </span>
                  </td>
                  <td className="amount-cell">{formatPrice(batch.totalAmountCents, batch.currency)}</td>
                  <td>{batch.orderCount}</td>
                  <td className="success-cell">{batch.executedCount}</td>
                  <td className="blocked-cell">{batch.blockedCount}</td>
                  <td className="failed-cell">{batch.failedCount}</td>
                  <td>{formatDate(batch.createdAt)}</td>
                  <td>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => navigate(`/payouts/batches/${batch.batchId}`)}
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <PayoutBatchCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBatch}
          isCreating={isCreating}
        />
      )}
    </div>
  );
}

/**
 * Modal para criar payout batch
 */
interface PayoutBatchCreateModalProps {
  onClose: () => void;
  onCreate: (input: CreatePayoutBatchInput) => void;
  isCreating: boolean;
}

function PayoutBatchCreateModal({ onClose, onCreate, isCreating }: PayoutBatchCreateModalProps) {
  const [input, setInput] = useState<CreatePayoutBatchInput>({
    currency: 'BRL',
    payoutMethod: 'MANUAL',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(input);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Criar Payout Batch</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Data Início:</label>
            <input
              type="date"
              value={input.startDate || ''}
              onChange={(e) => setInput({ ...input, startDate: e.target.value || undefined })}
            />
          </div>
          <div className="form-group">
            <label>Data Fim:</label>
            <input
              type="date"
              value={input.endDate || ''}
              onChange={(e) => setInput({ ...input, endDate: e.target.value || undefined })}
            />
          </div>
          <div className="form-group">
            <label>Valor Mínimo (centavos):</label>
            <input
              type="number"
              value={input.minAmountCents || ''}
              onChange={(e) => setInput({ ...input, minAmountCents: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="form-group">
            <label>Moeda:</label>
            <select
              value={input.currency || 'BRL'}
              onChange={(e) => setInput({ ...input, currency: e.target.value })}
            >
              <option value="BRL">BRL</option>
            </select>
          </div>
          <div className="form-group">
            <label>Método de Payout:</label>
            <select
              value={input.payoutMethod || 'MANUAL'}
              onChange={(e) => setInput({ ...input, payoutMethod: e.target.value as any })}
            >
              <option value="MANUAL">Manual</option>
              <option value="BANK_TRANSFER">Transferência Bancária</option>
              <option value="PIX">PIX</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isCreating}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isCreating}>
              {isCreating ? 'Criando...' : 'Criar Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




