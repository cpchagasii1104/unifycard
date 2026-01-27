// frontend/src/components/marketplace/PaymentExecutor.tsx
// UX CANÔNICA: Executor de pagamento
// 🔴 BLINDAGEM: Apenas UI, sem lógica financeira

import { type PaymentPlan } from '../../api/marketplace';
import './PaymentExecutor.css';

interface PaymentExecutorProps {
  paymentPlan: PaymentPlan;
  onExecute: () => void;
  executing: boolean;
  error?: string | null;
}

export default function PaymentExecutor({
  paymentPlan,
  onExecute,
  executing,
  error,
}: PaymentExecutorProps) {
  const formatPrice = (cents: number): string => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="payment-executor">
      <h3>Confirmar Pagamento</h3>

      <div className="payment-summary">
        <div className="summary-row">
          <span>Método:</span>
          <span>
            {paymentPlan.method === 'balance' && 'Saldo UnifiCard'}
            {paymentPlan.method === 'card' && 'Cartão de Crédito/Débito'}
            {paymentPlan.method === 'invoice' && 'Fatura (B2B)'}
          </span>
        </div>
        <div className="summary-row total">
          <span>Total a pagar:</span>
          <strong>{formatPrice(paymentPlan.total)}</strong>
        </div>
      </div>

      {/* NOTA: Não exibimos splits na UX (conforme UX canônica) */}
      {/* Splits são estrutura interna do Core, não devem ser expostos */}

      <div className="payment-warning">
        <p>
          <strong>Atenção:</strong> Ao confirmar, o valor será debitado e o pagamento será processado.
        </p>
      </div>

      {error && (
        <div className="payment-error">
          <h4>Erro no pagamento</h4>
          <p>{error}</p>
          <p className="error-note">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      )}

      <div className="payment-actions">
        <button
          className="btn-execute"
          onClick={onExecute}
          disabled={executing || paymentPlan.status === 'executed'}
        >
          {executing ? 'Processando...' : 'Confirmar e Pagar'}
        </button>
      </div>

      {paymentPlan.status === 'executed' && (
        <div className="payment-success">
          <p>✅ Pagamento executado com sucesso!</p>
        </div>
      )}
    </div>
  );
}


