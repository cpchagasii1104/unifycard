// frontend/src/components/payout/PayoutExecuteModal.tsx
// Modal para Executar Payout Manual
// 🔴 BLINDAGEM: Confirmação explícita obrigatória

import { useState } from 'react';
import { type PayoutOrder, type ExecutePayoutManualInput } from '../../api/payouts';
import { showToast } from '../../utils/toast';
import './PayoutExecuteModal.css';

interface PayoutExecuteModalProps {
  order: PayoutOrder;
  onClose: () => void;
  onExecute: (input: ExecutePayoutManualInput) => void;
}

export default function PayoutExecuteModal({ order, onClose, onExecute }: PayoutExecuteModalProps) {
  const [executionMetadata, setExecutionMetadata] = useState<Record<string, any>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmed) {
      showToast('Você deve confirmar que entendeu as consequências', 'error');
      return;
    }

    setIsExecuting(true);
    try {
      onExecute({
        executedByActorId: '', // Será preenchido pelo componente pai
        executionMetadata: Object.keys(executionMetadata).length > 0 ? executionMetadata : undefined,
      });
    } catch (err) {
      setIsExecuting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Executar Payout Manual</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="execute-warning">
            <h3>⚠️ Aviso Importante</h3>
            <p>
              Você está prestes a confirmar que o pagamento de{' '}
              <strong>{formatPrice(order.amountCents, order.currency)}</strong> foi executado
              manualmente fora da plataforma.
            </p>
            <p>
              <strong>Esta ação é registrada e não reversível.</strong> Certifique-se de que:
            </p>
            <ul>
              <li>O pagamento foi efetivamente realizado</li>
              <li>Você possui comprovante do pagamento</li>
              <li>O beneficiário confirmou o recebimento</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Dados de Execução (opcional):</label>
              <textarea
                placeholder='Ex: {"comprovante": "url", "dataPagamento": "2024-01-15", "observacoes": "..."}'
                value={JSON.stringify(executionMetadata, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setExecutionMetadata(parsed);
                  } catch (err) {
                    // Ignorar JSON inválido
                  }
                }}
                rows={6}
                className="form-textarea"
              />
              <small className="form-hint">
                JSON opcional com dados de execução (comprovante, data, etc.)
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  Confirmo que o pagamento foi executado e entendo que esta ação é{' '}
                  <strong>irreversível</strong>
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isExecuting}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary btn-danger"
                disabled={!confirmed || isExecuting}
              >
                {isExecuting ? 'Executando...' : 'Confirmar Execução'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




