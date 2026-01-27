// frontend/src/pages/CheckoutPage.tsx
// Página de checkout multi-vendor conforme UX canônica
// 🔴 BLINDAGEM: Apenas orquestração, sem lógica financeira

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CheckoutMultiVendor from '../components/marketplace/CheckoutMultiVendor';
import PaymentMethodSelector from '../components/marketplace/PaymentMethodSelector';
import PaymentExecutor from '../components/marketplace/PaymentExecutor';
import {
  createPaymentPlan,
  executePaymentPlan,
  type PaymentPlan,
  type CreatePaymentPlanInput,
} from '../api/marketplace';
import { showToast } from '../utils/toast';
import './CheckoutPage.css';

export default function CheckoutPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const navigate = useNavigate();

  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'card' | 'invoice' | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!checkoutId) {
    return (
      <div className="checkout-page error">
        <div className="error-message">
          <h3>Checkout não encontrado</h3>
          <p>O ID do checkout não foi fornecido.</p>
          <button onClick={() => navigate('/marketplace')}>Voltar ao Marketplace</button>
        </div>
      </div>
    );
  }

  const handleCheckoutConfirmed = async () => {
    // Checkout foi confirmado, aguardar seleção de método de pagamento
    // Payment plan será criado quando método for selecionado
  };

  const handlePaymentMethodSelected = async (method: 'balance' | 'card' | 'invoice') => {
    try {
      setError(null);
      setPaymentMethod(method);

      // Criar payment plan via API (backend calcula splits)
      const plan = await createPaymentPlan(checkoutId, { method });
      setPaymentPlan(plan);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar plano de pagamento';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  };

  const handlePaymentExecute = async () => {
    if (!paymentPlan) return;

    try {
      setExecuting(true);
      setError(null);

      // Executar pagamento via API (backend executa transação e splits)
      const result = await executePaymentPlan(paymentPlan.payment_plan_id);

      // Pagamento executado com sucesso
      showToast('Pagamento executado com sucesso!', 'success');
      
      // Redirecionar para página de confirmação ou pedidos
      navigate('/my-orders');
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao executar pagamento';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <CheckoutMultiVendor
          checkoutId={checkoutId}
          onPaymentPlanCreated={handleCheckoutConfirmed}
          onError={(err) => {
            setError(err);
            showToast(err, 'error');
          }}
        />

        {/* Seleção de método de pagamento (após checkout confirmado) */}
        {!paymentPlan && (
          <PaymentMethodSelector
            onMethodSelected={handlePaymentMethodSelected}
            error={error}
          />
        )}

        {/* Execução de pagamento (após payment plan criado) */}
        {paymentPlan && (
          <PaymentExecutor
            paymentPlan={paymentPlan}
            onExecute={handlePaymentExecute}
            executing={executing}
            error={error}
          />
        )}
      </div>
    </div>
  );
}


