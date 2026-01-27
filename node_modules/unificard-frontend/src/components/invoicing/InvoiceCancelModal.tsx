// frontend/src/components/invoicing/InvoiceCancelModal.tsx
// Modal para Cancelar Invoice
// 🔴 BLINDAGEM: Motivo obrigatório

import { useState } from 'react';
import { type Invoice, type CancelInvoiceInput } from '../../api/invoices';
import { showToast } from '../../utils/toast';
import './InvoiceCancelModal.css';

interface InvoiceCancelModalProps {
  invoice: Invoice;
  onClose: () => void;
  onCancel: (input: CancelInvoiceInput) => void;
}

export default function InvoiceCancelModal({ invoice, onClose, onCancel }: InvoiceCancelModalProps) {
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cancellationReason.trim()) {
      showToast('Motivo do cancelamento é obrigatório', 'error');
      return;
    }

    setIsCancelling(true);
    try {
      onCancel({
        cancelledByActorId: '', // Será preenchido pelo componente pai
        cancellationReason: cancellationReason.trim(),
      });
    } catch (err) {
      setIsCancelling(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cancelar Invoice</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="cancel-warning">
            <p>
              Você está prestes a cancelar o invoice de{' '}
              <strong>{formatPrice(invoice.totalCents, invoice.currency)}</strong>.
            </p>
            <p>
              <strong>Importante:</strong> O cancelamento não remove o histórico. 
              Todas as ações são registradas no Evidence Pack.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Motivo do Cancelamento <span className="required">*</span>:
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..."
                rows={4}
                className="form-textarea"
                required
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isCancelling}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary btn-warning"
                disabled={!cancellationReason.trim() || isCancelling}
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




