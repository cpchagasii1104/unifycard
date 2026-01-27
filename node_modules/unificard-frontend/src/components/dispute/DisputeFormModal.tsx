// frontend/src/components/dispute/DisputeFormModal.tsx
// CONTINUOUS PRODUCTION: Modal de Abertura de Disputa - SPRINT 11
// Permite solicitar revisão de uma ação de forma neutra e institucional

import { useState } from 'react';
import { type ActivityItem } from '../../services/activity-aggregation.service';
import { type DisputeReason, getDisputeReasonLabel, getDisputeReasonDescription } from '../../types/dispute';
import { getExpectationText } from '../../utils/canonical-language';
import { IrreversibilityMarker } from '../../utils/action-nature';
import './DisputeFormModal.css';

interface DisputeFormModalProps {
  activity: ActivityItem;
  onClose: () => void;
  onSubmit: (reason: DisputeReason, description: string) => Promise<void>;
}

const DISPUTE_REASONS: DisputeReason[] = ['erro', 'desacordo', 'execucao_indevida', 'outro'];

export default function DisputeFormModal({ activity, onClose, onSubmit }: DisputeFormModalProps) {
  const [reason, setReason] = useState<DisputeReason>('outro');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setError('Por favor, descreva o motivo da solicitação de revisão');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(reason, description.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao abrir solicitação de revisão');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dispute-form-modal-overlay" onClick={onClose}>
      <div className="dispute-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dispute-form-header">
          <h3>Solicitar Revisão</h3>
          <button onClick={onClose} className="dispute-form-close" type="button">
            ×
          </button>
        </div>

        <div className="dispute-form-content">
          <div className="dispute-form-activity-info">
            <p className="dispute-form-activity-description">{activity.description}</p>
            <p className="dispute-form-activity-date">
              Data: {new Date(activity.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="dispute-form-field">
              <label htmlFor="dispute-reason">Motivo da solicitação</label>
              <select
                id="dispute-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as DisputeReason)}
                className="dispute-form-select"
              >
                {DISPUTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {getDisputeReasonLabel(r)}
                  </option>
                ))}
              </select>
              {reason !== 'outro' && (
                <p className="dispute-form-hint">{getDisputeReasonDescription(reason)}</p>
              )}
            </div>

            <div className="dispute-form-field">
              <label htmlFor="dispute-description">
                Descrição <span className="dispute-form-required">*</span>
              </label>
              <textarea
                id="dispute-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o motivo da solicitação de revisão desta ação..."
                className="dispute-form-textarea"
                rows={5}
                required
              />
              <p className="dispute-form-hint">
                Seja específico sobre o que precisa ser revisado. Esta informação será visível para administradores.
              </p>
            </div>

            {error && (
              <div className="dispute-form-error">
                {error}
              </div>
            )}

            <div className="dispute-form-actions">
              <button
                type="button"
                onClick={onClose}
                className="dispute-form-cancel"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="dispute-form-submit"
                disabled={submitting || !description.trim()}
              >
                {submitting ? 'Enviando...' : 'Solicitar Revisão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


