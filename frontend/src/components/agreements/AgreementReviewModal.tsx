// frontend/src/components/agreements/AgreementReviewModal.tsx
// Modal de revisão antes de finalizar acordo
// 🔴 BLINDAGEM: Exige confirmação explícita antes de FINALIZED

import { type Agreement } from '../../api/agreements';
import AgreementSummary from './AgreementSummary';
import './AgreementReviewModal.css';

interface AgreementReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: Agreement;
  onConfirm: () => void;
}

export default function AgreementReviewModal({
  isOpen,
  onClose,
  agreement,
  onConfirm,
}: AgreementReviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="agreement-review-modal-overlay" onClick={onClose}>
      <div className="agreement-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Revisar e Finalizar Acordo</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="agreement-review-warning">
            <strong>⚠️ Atenção:</strong> Ao finalizar este acordo, ele se tornará imutável e será
            usado como referência para criar bookings, bundles ou service orders.
          </div>

          <AgreementSummary agreement={agreement} />

          <div className="agreement-review-checklist">
            <h4>Confirme antes de finalizar:</h4>
            <ul>
              <li>✓ Valor está correto</li>
              <li>✓ Escopo está completo</li>
              <li>✓ Itens inclusos e excluídos estão claros</li>
              <li>✓ Responsabilidades estão definidas</li>
              <li>✓ Ambos os participantes aceitaram o acordo</li>
            </ul>
          </div>

          <div className="agreement-review-audit-notice">
            <small>
              ℹ️ Este histórico é usado em caso de disputa. Todas as alterações são registradas
              permanentemente.
            </small>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={onConfirm}>
            Finalizar Acordo
          </button>
        </div>
      </div>
    </div>
  );
}




