// frontend/src/components/escrow/EscrowPanel.tsx
// Painel de Escrow Account com marcos de pagamento
// 🔴 BLINDAGEM: Frontend apenas reflete estado, não calcula valores

import { useState, useEffect } from 'react';
import {
  getEscrowByAgreement,
  listMilestones,
  listTransactions,
  authorizeMilestone,
  releasePayment,
  type EscrowAccount,
  type PaymentMilestoneRecord,
  type EscrowTransaction,
} from '../../api/escrow';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../../utils/toast';
import PaymentMilestoneTimeline from './PaymentMilestoneTimeline';
import './EscrowPanel.css';

interface EscrowPanelProps {
  agreementId: string;
  onEscrowUpdated?: (escrow: EscrowAccount) => void;
}

export default function EscrowPanel({ agreementId, onEscrowUpdated }: EscrowPanelProps) {
  const { activeActor } = useActiveActor();
  const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestoneRecord[]>([]);
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    loadEscrowData();
  }, [agreementId]);

  const loadEscrowData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const escrowData = await getEscrowByAgreement(agreementId);
      if (escrowData) {
        setEscrow(escrowData);
        const [milestonesData, transactionsData] = await Promise.all([
          listMilestones(escrowData.escrowId),
          listTransactions(escrowData.escrowId),
        ]);
        setMilestones(milestonesData);
        setTransactions(transactionsData);
      } else {
        setEscrow(null);
        setMilestones([]);
        setTransactions([]);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar escrow');
      console.error('Erro ao carregar escrow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorizeMilestone = async (milestone: PaymentMilestoneRecord) => {
    if (!escrow || !activeActor) return;

    setIsAuthorizing(true);
    try {
      const updated = await authorizeMilestone(escrow.escrowId, {
        milestone: milestone.milestone,
        authorizedByActorId: activeActor.actor_id,
      });
      
      // Atualizar milestone na lista
      setMilestones((prev) =>
        prev.map((m) => (m.milestoneId === updated.milestoneId ? updated : m))
      );
      
      // Recarregar escrow
      await loadEscrowData();
      
      showToast(`Marco ${milestone.milestone} autorizado com sucesso`, 'success');
      
      if (onEscrowUpdated && escrow) {
        const updatedEscrow = await getEscrowByAgreement(agreementId);
        if (updatedEscrow) {
          onEscrowUpdated(updatedEscrow);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao autorizar milestone', 'error');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleReleasePayment = async (milestone: PaymentMilestoneRecord) => {
    if (!escrow || !activeActor) return;

    setIsReleasing(true);
    try {
      const result = await releasePayment(escrow.escrowId, {
        milestone: milestone.milestone,
        releasedByActorId: activeActor.actor_id,
      });
      
      setEscrow(result.escrow);
      setTransactions((prev) => [result.transaction, ...prev]);
      
      // Recarregar milestones
      const updatedMilestones = await listMilestones(escrow.escrowId);
      setMilestones(updatedMilestones);
      
      showToast(`Pagamento de ${milestone.milestone} liberado com sucesso`, 'success');
      
      if (onEscrowUpdated) {
        onEscrowUpdated(result.escrow);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao liberar pagamento', 'error');
    } finally {
      setIsReleasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="escrow-panel">
        <div className="escrow-panel-loading">Carregando escrow...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="escrow-panel">
        <div className="escrow-panel-error">{error}</div>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="escrow-panel">
        <div className="escrow-panel-empty">
          <p>Nenhum escrow account criado ainda.</p>
          <p className="escrow-panel-hint">
            Crie um escrow account a partir do acordo finalizado.
          </p>
        </div>
      </div>
    );
  }

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const canAuthorize = (milestone: PaymentMilestoneRecord) => {
    return milestone.status === 'PENDING' && !isAuthorizing;
  };

  const canRelease = (milestone: PaymentMilestoneRecord) => {
    return (
      milestone.status === 'AUTHORIZED' &&
      escrow.status !== 'BLOCKED_BY_DISPUTE' &&
      escrow.disputeStatus !== 'OPEN' &&
      !isReleasing
    );
  };

  return (
    <div className="escrow-panel">
      <div className="escrow-panel-header">
        <h3>Escrow Account</h3>
        <span className={`escrow-status-badge escrow-status-${escrow.status.toLowerCase().replace('_', '-')}`}>
          {escrow.status === 'PENDING' && 'Pendente'}
          {escrow.status === 'FUNDS_HELD' && 'Fundos Retidos'}
          {escrow.status === 'READY_TO_RELEASE' && 'Pronto para Liberar'}
          {escrow.status === 'RELEASED' && 'Liberado'}
          {escrow.status === 'REFUNDED' && 'Reembolsado'}
          {escrow.status === 'BLOCKED_BY_DISPUTE' && 'Bloqueado por Disputa'}
        </span>
      </div>

      <div className="escrow-panel-summary">
        <div className="escrow-summary-item">
          <strong>Valor Total:</strong> {formatPrice(escrow.totalAmountCents, escrow.currency)}
        </div>
        <div className="escrow-summary-item">
          <strong>Retido:</strong> {formatPrice(escrow.heldAmountCents, escrow.currency)}
        </div>
        <div className="escrow-summary-item">
          <strong>Liberado:</strong> {formatPrice(escrow.releasedAmountCents, escrow.currency)}
        </div>
        {escrow.refundedAmountCents > 0 && (
          <div className="escrow-summary-item">
            <strong>Reembolsado:</strong> {formatPrice(escrow.refundedAmountCents, escrow.currency)}
          </div>
        )}
        {escrow.disputeStatus === 'OPEN' && (
          <div className="escrow-dispute-warning">
            ⚠️ Disputa aberta bloqueia liberação de pagamentos
          </div>
        )}
      </div>

      <PaymentMilestoneTimeline
        milestones={milestones}
        transactions={transactions}
        escrowStatus={escrow.status}
        disputeStatus={escrow.disputeStatus}
        onAuthorize={handleAuthorizeMilestone}
        onRelease={handleReleasePayment}
        canAuthorize={canAuthorize}
        canRelease={canRelease}
        isAuthorizing={isAuthorizing}
        isReleasing={isReleasing}
      />
    </div>
  );
}




