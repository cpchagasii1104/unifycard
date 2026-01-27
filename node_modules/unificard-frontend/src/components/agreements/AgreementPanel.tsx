// frontend/src/components/agreements/AgreementPanel.tsx
// Painel de Negociação Assistida - Exibido ao lado do chat contextual
// 🔴 BLINDAGEM: Frontend apenas reflete estado do backend, não calcula valores

import { useState, useEffect } from 'react';
import { getAgreement, listAgreements, type Agreement } from '../../api/agreements';
import AgreementSummary from './AgreementSummary';
import AgreementEditModal from './AgreementEditModal';
import AgreementReviewModal from './AgreementReviewModal';
import AgreementHistory from './AgreementHistory';
import EscrowPanel from '../escrow/EscrowPanel';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../../utils/toast';
import './AgreementPanel.css';

interface AgreementPanelProps {
  contextType: 'event' | 'service' | 'rfq' | 'booking' | 'bundle';
  contextId: string;
  threadId?: string | null;
  requesterActorId: string;
  providerActorId: string;
  onAgreementFinalized?: (agreement: Agreement) => void;
}

export default function AgreementPanel({
  contextType,
  contextId,
  threadId,
  requesterActorId,
  providerActorId,
  onAgreementFinalized,
}: AgreementPanelProps) {
  const { activeActor } = useActiveActor();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    loadAgreement();
  }, [contextType, contextId, threadId]);

  const loadAgreement = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {
        contextType,
        contextId,
        limit: 1,
      };

      if (threadId) {
        filters.threadId = threadId;
      }

      const result = await listAgreements(filters);

      if (result.agreements.length > 0) {
        // Buscar o mais recente ou o que não está FINALIZED
        const nonFinalized = result.agreements.find((a) => a.status !== 'FINALIZED');
        setAgreement(nonFinalized || result.agreements[0]);
      } else {
        setAgreement(null);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar acordo');
      console.error('Erro ao carregar acordo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgreementUpdated = (updated: Agreement) => {
    setAgreement(updated);
    setIsEditModalOpen(false);

    if (updated.status === 'FINALIZED' && onAgreementFinalized) {
      onAgreementFinalized(updated);
    }
  };

  const handlePropose = async () => {
    if (!agreement || !activeActor) return;

    try {
      const { proposeAgreement } = await import('../../api/agreements');
      const updated = await proposeAgreement(agreement.agreementId, {});
      setAgreement(updated);
      showToast('Acordo proposto com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao propor acordo', 'error');
    }
  };

  const handleAccept = async () => {
    if (!agreement || !activeActor) return;

    try {
      const { acceptAgreement } = await import('../../api/agreements');
      const updated = await acceptAgreement(agreement.agreementId, {
        actorId: activeActor.actor_id,
      });
      setAgreement(updated);
      showToast('Acordo aceito com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao aceitar acordo', 'error');
    }
  };

  const handleFinalize = async () => {
    if (!agreement || !activeActor) {
      setIsReviewModalOpen(true);
      return;
    }

    setIsReviewModalOpen(true);
  };

  const handleFinalizeConfirm = async () => {
    if (!agreement || !activeActor) return;

    try {
      const { finalizeAgreement } = await import('../../api/agreements');
      const updated = await finalizeAgreement(agreement.agreementId, {
        actorId: activeActor.actor_id,
      });
      setAgreement(updated);
      setIsReviewModalOpen(false);
      showToast('Acordo finalizado com sucesso', 'success');

      if (onAgreementFinalized) {
        onAgreementFinalized(updated);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao finalizar acordo', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="agreement-panel">
        <div className="agreement-panel-loading">Carregando acordo...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agreement-panel">
        <div className="agreement-panel-error">{error}</div>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="agreement-panel">
        <div className="agreement-panel-empty">
          <p>Nenhum acordo criado ainda.</p>
          <p className="agreement-panel-hint">
            Use o chat para negociar e criar um acordo.
          </p>
        </div>
      </div>
    );
  }

  const isRequester = activeActor?.actor_id === requesterActorId;
  const isProvider = activeActor?.actor_id === providerActorId;
  const canEdit = (agreement.status === 'DRAFT' || agreement.status === 'PROPOSED') && isRequester;
  const canPropose = agreement.status === 'DRAFT' && isRequester;
  const canAccept = agreement.status === 'PROPOSED' && (isRequester || isProvider);
  const canFinalize = agreement.status === 'ACCEPTED' && (isRequester || isProvider);
  const isFinalized = agreement.status === 'FINALIZED';

  return (
    <div className="agreement-panel">
      <div className="agreement-panel-header">
        <h3>Acordo de Negociação</h3>
        <span className={`agreement-status-badge agreement-status-${agreement.status.toLowerCase()}`}>
          {agreement.status === 'DRAFT' && 'Rascunho'}
          {agreement.status === 'PROPOSED' && 'Proposto'}
          {agreement.status === 'ACCEPTED' && 'Aceito'}
          {agreement.status === 'FINALIZED' && 'Finalizado'}
        </span>
      </div>

      <AgreementSummary agreement={agreement} />

      {!isFinalized && (
        <div className="agreement-panel-actions">
          {canEdit && (
            <button
              className="btn-secondary"
              onClick={() => setIsEditModalOpen(true)}
            >
              Editar Acordo
            </button>
          )}

          {canPropose && (
            <button className="btn-primary" onClick={handlePropose}>
              Propor Acordo
            </button>
          )}

          {canAccept && (
            <button className="btn-primary" onClick={handleAccept}>
              Aceitar Acordo
            </button>
          )}

          {canFinalize && (
            <button className="btn-primary" onClick={handleFinalize}>
              Finalizar Acordo
            </button>
          )}
        </div>
      )}

      {isFinalized && (
        <div className="agreement-panel-finalized">
          <div className="agreement-finalized-badge">✓ Acordo Finalizado</div>
          {agreement.finalizedAt && (
            <div className="agreement-finalized-date">
              Finalizado em: {new Date(agreement.finalizedAt).toLocaleString('pt-BR')}
            </div>
          )}
          <div className="agreement-legal-notice">
            <small>
              ℹ️ Este acordo é registrado e utilizado em caso de disputa. Todas as alterações são permanentes.
            </small>
          </div>
        </div>
      )}

      {/* Histórico do Acordo */}
      <AgreementHistory agreement={agreement} />

      {/* Modais */}
      {isEditModalOpen && agreement && (
        <AgreementEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          agreement={agreement}
          onSave={handleAgreementUpdated}
        />
      )}

      {isReviewModalOpen && agreement && (
        <AgreementReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          agreement={agreement}
          onConfirm={handleFinalizeConfirm}
        />
      )}
    </div>
  );
}

