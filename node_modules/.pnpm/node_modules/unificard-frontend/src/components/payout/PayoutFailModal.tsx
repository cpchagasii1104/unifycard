// frontend/src/components/payout/PayoutFailModal.tsx
// Modal para Marcar Payout como Falho
// 🔴 BLINDAGEM: Motivo obrigatório

import { useState } from 'react';
import { type PayoutOrder, type FailPayoutInput } from '../../api/payouts';
import { showToast } from '../../utils/toast';
import './PayoutFailModal.css';

interface PayoutFailModalProps {
  order: PayoutOrder;
  onClose: () => void;
  onFail: (input: FailPayoutInput) => void;
}

export default function PayoutFailModal({ order, onClose, onFail }: PayoutFailModalProps) {
  const [failureReason, setFailureReason] = useState('');
  const [isFailing, setIsFailing] = useState(false);

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!failureReason.trim()) {
      showToast('Motivo da falha é obrigatório', 'error');
      return;
    }

    setIsFailing(true);
    try {
      onFail({
        failedByActorId: '', // Será preenchido pelo componente pai
        failureReason: failureReason.trim(),
      });
    } catch (err) {
      setIsFailing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Marcar Payout como Falho</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="fail-warning">
            <p>
              Você está prestes a marcar o payout de{' '}
              <strong>{formatPrice(order.amountCents, order.currency)}</strong> como falho.
            </p>
            <p>
              Esta ação será registrada no Evidence Pack e Audit Log.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Motivo da Falha <span className="required">*</span>:
              </label>
              <textarea
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="Descreva o motivo da falha do payout..."
                rows={4}
                className="form-textarea"
                required
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isFailing}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary btn-warning"
                disabled={!failureReason.trim() || isFailing}
              >
                {isFailing ? 'Marcando...' : 'Marcar como Falho'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




