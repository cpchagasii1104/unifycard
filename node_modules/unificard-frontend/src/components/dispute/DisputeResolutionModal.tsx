// frontend/src/components/dispute/DisputeResolutionModal.tsx
// CONTINUOUS PRODUCTION: Modal de Resolução de Disputa - SPRINT 11
// Permite resolver, rejeitar ou reverter uma disputa

import { useState } from 'react';
import { type Dispute } from '../../types/dispute';
import { type ActivityItem } from '../../services/activity-aggregation.service';
import { PassiveConfirmation, CoherenceSignal } from '../../utils/functioning-evidence';
import './DisputeResolutionModal.css';

interface DisputeResolutionModalProps {
  dispute: Dispute;
  relatedActivity: ActivityItem | undefined;
  onClose: () => void;
  onResolve: (disputeId: string, resolutionNote?: string) => Promise<void>;
  onReject: (disputeId: string, resolutionNote?: string) => Promise<void>;
  onRevert: (disputeId: string, transactionId: string, resolutionNote?: string) => Promise<void>;
}

export default function DisputeResolutionModal({
  dispute,
  relatedActivity,
  onClose,
  onResolve,
  onReject,
  onRevert,
}: DisputeResolutionModalProps) {
  const [action, setAction] = useState<'resolve' | 'reject' | 'revert' | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!action) return;

    setSubmitting(true);
    setError(null);

    try {
      if (action === 'resolve') {
        await onResolve(dispute.id, resolutionNote || undefined);
      } else if (action === 'reject') {
        await onReject(dispute.id, resolutionNote || undefined);
      } else if (action === 'revert') {
        const txId = transactionId || relatedActivity?.metadata?.transactionId;
        if (!txId) {
          setError('ID da transação é necessário para reversão');
          setSubmitting(false);
          return;
        }
        await onRevert(dispute.id, txId, resolutionNote || undefined);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar resolução');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="dispute-resolution-modal-overlay" onClick={onClose}>
      <div className="dispute-resolution-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dispute-resolution-header">
          <h3>Resolver Solicitação de Revisão</h3>
          <button onClick={onClose} className="dispute-resolution-close" type="button">
            ×
          </button>
        </div>

        <div className="dispute-resolution-content">
          {relatedActivity && (
            <div className="dispute-resolution-activity">
              <h4>Ação Contestada</h4>
              <p>{relatedActivity.description}</p>
              <p className="dispute-resolution-activity-date">
                Data: {formatDate(relatedActivity.createdAt)}
              </p>
            </div>
          )}

          <div className="dispute-resolution-dispute-info">
            <h4>Solicitação</h4>
            <p><strong>Motivo:</strong> {dispute.reason}</p>
            <p><strong>Descrição:</strong> {dispute.description}</p>
            <p><strong>Aberta em:</strong> {formatDate(dispute.openedAt)}</p>
            <p><strong>Por:</strong> {dispute.openedByUserId.substring(0, 8)}...</p>
          </div>

          <div className="dispute-resolution-actions">
            <h4>Ação de Resolução</h4>
            <div className="dispute-resolution-options">
              <button
                onClick={() => setAction('resolve')}
                className={`dispute-resolution-option ${action === 'resolve' ? 'selected' : ''}`}
                type="button"
              >
                <strong>Marcar como Resolvida</strong>
                <span>Sem reversão técnica. A ação permanece, mas a questão foi esclarecida.</span>
              </button>
              <button
                onClick={() => setAction('reject')}
                className={`dispute-resolution-option ${action === 'reject' ? 'selected' : ''}`}
                type="button"
              >
                <strong>Rejeitar Solicitação</strong>
                <span>A solicitação não é válida ou não requer ação.</span>
              </button>
              {relatedActivity?.type === 'transaction' && (
                <button
                  onClick={() => setAction('revert')}
                  className={`dispute-resolution-option ${action === 'revert' ? 'selected' : ''}`}
                  type="button"
                >
                  <strong>Reverter Ação</strong>
                  <span>Reverter a transação técnica. Esta ação não pode ser desfeita.</span>
                </button>
              )}
            </div>
          </div>

          {action && (
            <div className="dispute-resolution-form">
              {action === 'revert' && (
                <div className="dispute-resolution-field">
                  <label htmlFor="transaction-id">
                    ID da Transação <span className="dispute-resolution-required">*</span>
                  </label>
                  <input
                    id="transaction-id"
                    type="text"
                    value={transactionId || relatedActivity?.metadata?.transactionId || ''}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="ID da transação a ser revertida"
                    className="dispute-resolution-input"
                    required={action === 'revert'}
                  />
                </div>
              )}
              <div className="dispute-resolution-field">
                <label htmlFor="resolution-note">Nota de Resolução (opcional)</label>
                <textarea
                  id="resolution-note"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Adicione uma nota explicando a resolução..."
                  className="dispute-resolution-textarea"
                  rows={3}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="dispute-resolution-error">
              {error}
            </div>
          )}

          <div className="dispute-resolution-footer">
            <button
              onClick={onClose}
              className="dispute-resolution-cancel"
              disabled={submitting}
              type="button"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="dispute-resolution-submit"
              disabled={submitting || !action}
              type="button"
            >
              {submitting ? 'Processando...' : 'Confirmar Resolução'}
            </button>
          </div>

          {/* SPRINT 21: Evidência de funcionamento - rodapé informativo */}
          <div style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e0e0e0',
          }}>
            <CoherenceSignal type="processed" />
          </div>
        </div>
      </div>
    </div>
  );
}


