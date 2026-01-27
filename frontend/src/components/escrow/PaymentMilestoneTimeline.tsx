// frontend/src/components/escrow/PaymentMilestoneTimeline.tsx
// Timeline de marcos de pagamento (HOLD → RELEASE)
// 🔴 BLINDAGEM: Apenas exibe estado, não calcula valores

import {
  type PaymentMilestoneRecord,
  type EscrowTransaction,
  type EscrowStatus,
} from '../../api/escrow';
import './PaymentMilestoneTimeline.css';

interface PaymentMilestoneTimelineProps {
  milestones: PaymentMilestoneRecord[];
  transactions: EscrowTransaction[];
  escrowStatus: EscrowStatus;
  disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED';
  onAuthorize: (milestone: PaymentMilestoneRecord) => void;
  onRelease: (milestone: PaymentMilestoneRecord) => void;
  canAuthorize: (milestone: PaymentMilestoneRecord) => boolean;
  canRelease: (milestone: PaymentMilestoneRecord) => boolean;
  isAuthorizing: boolean;
  isReleasing: boolean;
}

export default function PaymentMilestoneTimeline({
  milestones,
  transactions,
  escrowStatus,
  disputeStatus,
  onAuthorize,
  onRelease,
  canAuthorize,
  canRelease,
  isAuthorizing,
  isReleasing,
}: PaymentMilestoneTimelineProps) {
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

  const getMilestoneLabel = (milestone: string) => {
    const labels: Record<string, string> = {
      CONFIRMED: 'Confirmado',
      STARTED: 'Iniciado',
      COMPLETED: 'Completado',
    };
    return labels[milestone] || milestone;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      PENDING: '⏳',
      AUTHORIZED: '✓',
      RELEASED: '💰',
    };
    return icons[status] || '•';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'pending',
      AUTHORIZED: 'authorized',
      RELEASED: 'released',
    };
    return colors[status] || 'default';
  };

  // Ordenar milestones por ordem lógica
  const milestoneOrder: Record<string, number> = {
    CONFIRMED: 1,
    STARTED: 2,
    COMPLETED: 3,
  };

  const sortedMilestones = [...milestones].sort(
    (a, b) => milestoneOrder[a.milestone] - milestoneOrder[b.milestone]
  );

  if (milestones.length === 0) {
    return (
      <div className="payment-milestone-timeline-empty">
        <p>Nenhum marco de pagamento configurado.</p>
      </div>
    );
  }

  return (
    <div className="payment-milestone-timeline">
      <h4>Marcos de Pagamento</h4>
      <div className="milestones-list">
        {sortedMilestones.map((milestone, index) => {
          const milestoneTransactions = transactions.filter(
            (t) => t.milestoneId === milestone.milestoneId
          );
          const releaseTransaction = milestoneTransactions.find((t) => t.transactionType === 'RELEASE');

          return (
            <div
              key={milestone.milestoneId}
              className={`milestone-item milestone-${getStatusColor(milestone.status)}`}
            >
              <div className="milestone-marker">
                <span className="milestone-icon">{getStatusIcon(milestone.status)}</span>
              </div>
              <div className="milestone-content">
                <div className="milestone-header">
                  <strong>{getMilestoneLabel(milestone.milestone)}</strong>
                  <span className="milestone-amount">
                    {formatPrice(milestone.amountCents, 'BRL')} ({milestone.percentage}%)
                  </span>
                </div>
                <div className="milestone-status">
                  Status: <strong>{milestone.status}</strong>
                </div>
                {milestone.authorizedAt && (
                  <div className="milestone-date">
                    Autorizado em: {formatDate(milestone.authorizedAt)}
                  </div>
                )}
                {milestone.releasedAt && (
                  <div className="milestone-date">
                    Liberado em: {formatDate(milestone.releasedAt)}
                  </div>
                )}
                {releaseTransaction && (
                  <div className="milestone-transaction">
                    Transação: {releaseTransaction.transactionId.substring(0, 8)}...
                    {releaseTransaction.bankTransactionId && (
                      <span className="bank-transaction-id">
                        {' '}
                        (Bancária: {releaseTransaction.bankTransactionId.substring(0, 8)}...)
                      </span>
                    )}
                  </div>
                )}
                <div className="milestone-actions">
                  {canAuthorize(milestone) && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => onAuthorize(milestone)}
                      disabled={isAuthorizing}
                    >
                      {isAuthorizing ? 'Autorizando...' : 'Autorizar Marco'}
                    </button>
                  )}
                  {canRelease(milestone) && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => onRelease(milestone)}
                      disabled={isReleasing || disputeStatus === 'OPEN'}
                    >
                      {isReleasing ? 'Liberando...' : 'Liberar Pagamento'}
                    </button>
                  )}
                  {milestone.status === 'PENDING' && !canAuthorize(milestone) && (
                    <span className="milestone-hint">
                      Aguardando autorização de marcos anteriores
                    </span>
                  )}
                  {milestone.status === 'AUTHORIZED' && !canRelease(milestone) && (
                    <span className="milestone-hint">
                      {disputeStatus === 'OPEN'
                        ? 'Bloqueado por disputa aberta'
                        : 'Aguardando liberação'}
                    </span>
                  )}
                </div>
              </div>
              {index < sortedMilestones.length - 1 && <div className="milestone-connector" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}




