// frontend/src/pages/CheckoutPage.tsx
// F-MARKETPLACE-CHECKOUT-STUB-CONTRACT-CONTAINMENT-SLICE-A (2026-06-28)
// DT-MARKETPLACE-CHECKOUT-FRONTEND-WIRED-TO-BACKEND-STUBS.
//
// CONTENÇÃO HONESTA: esta tela ligava em rotas de backend que estão STUB VAZIO /
// desabilitadas (createPaymentPlan → /marketplace/payment-plan/.../execute;
// executePaymentPlan → MarketplaceService.executePaymentPlan() lança
// LEGACY_FINANCIAL_PATH_DISABLED). Renderizar o fluxo de pagamento aqui era
// "tela viva que finge funcionalidade inexistente" — viola "frontend nunca cria
// verdade — projeta verdade resolvida".
//
// Enquanto o backend de checkout/pagamento estiver em HOLD (depende de DECISION-0114
// + PORTA-1/bucket D), esta página é um TERMINAL HONESTO: não dispara nenhuma chamada
// de compra, não cria order/payment-plan, não toca Bank/ledger/split/settlement.

import { useNavigate } from 'react-router-dom';
import './CheckoutPage.css';

export default function CheckoutPage() {
  const navigate = useNavigate();

  return (
    <div className="checkout-page error">
      <div className="error-message">
        <h3>Compra de produtos ainda não está habilitada neste MVP</h3>
        <p>
          Catálogo, oferta e estoque estão em preparação; pagamento e checkout
          seguem em HOLD. Assim que a compra for liberada, este fluxo passa a
          funcionar de ponta a ponta.
        </p>
        <button onClick={() => navigate('/marketplace')} type="button">
          ← Voltar ao Marketplace
        </button>
      </div>
    </div>
  );
}
