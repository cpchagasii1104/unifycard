// frontend/src/components/invoicing/InvoiceIssueModal.tsx
// Modal para Emitir Invoice
// 🔴 BLINDAGEM: Confirmação explícita obrigatória

import { useState } from 'react';
import { type Invoice, type IssueInvoiceInput } from '../../api/invoices';
import { showToast } from '../../utils/toast';
import './InvoiceIssueModal.css';

interface InvoiceIssueModalProps {
  invoice: Invoice;
  onClose: () => void;
  onIssue: (input: IssueInvoiceInput) => void;
}

export default function InvoiceIssueModal({ invoice, onClose, onIssue }: InvoiceIssueModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);

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

    setIsIssuing(true);
    try {
      onIssue({
        issuedByActorId: '', // Será preenchido pelo componente pai
      });
    } catch (err) {
      setIsIssuing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Emitir Invoice</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="issue-warning">
            <h3>⚠️ Aviso Importante</h3>
            <p>
              Você está prestes a emitir o invoice de{' '}
              <strong>{formatPrice(invoice.totalCents, invoice.currency)}</strong>.
            </p>
            <p>
              <strong>Esta ação é irreversível.</strong> Após a emissão:
            </p>
            <ul>
              <li>O invoice não pode ser alterado</li>
              <li>O documento fiscal é imutável</li>
              <li>Todas as alterações são registradas no Evidence Pack</li>
              <li>O cancelamento não remove o histórico</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  Confirmo que entendo que esta ação é{' '}
                  <strong>irreversível</strong> e que o invoice não pode ser alterado após emissão
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isIssuing}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary btn-success"
                disabled={!confirmed || isIssuing}
              >
                {isIssuing ? 'Emitindo...' : 'Confirmar Emissão'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




