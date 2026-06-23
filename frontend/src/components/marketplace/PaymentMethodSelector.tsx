// frontend/src/components/marketplace/PaymentMethodSelector.tsx
// UX CANÔNICA: Seletor de método de pagamento
// 🔴 BLINDAGEM: Apenas UI, sem lógica financeira

import { useState } from 'react';
import './PaymentMethodSelector.css';

interface PaymentMethodSelectorProps {
  onMethodSelected: (method: 'balance' | 'card' | 'invoice') => void;
  error?: string | null;
}

export default function PaymentMethodSelector({
  onMethodSelected,
  error,
}: PaymentMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<'balance' | 'card' | 'invoice' | null>(null);

  const handleSelect = (method: 'balance' | 'card' | 'invoice') => {
    setSelectedMethod(method);
  };

  const handleConfirm = () => {
    if (selectedMethod) {
      onMethodSelected(selectedMethod);
    }
  };

  return (
    <div className="payment-method-selector">
      <h3>Selecione o método de pagamento</h3>

      {/* 🔴 F-HANDLEPAYMENT (A): honestidade — dinheiro real em HOLD; métodos sujeitos a disponibilidade.
          Não promete sucesso; o backend é fail-closed e devolve erro honesto se o runtime financeiro estiver OFF. */}
      <div className="payment-method-notice" role="note" style={{
        margin: '0 0 1rem', padding: '0.6rem 0.75rem', background: '#fff8e1',
        border: '1px solid #ffe0a3', borderRadius: '4px', fontSize: '0.85rem', color: '#7a5b00', lineHeight: 1.4,
      }}>
        ⚠️ Fluxo financeiro em desenvolvimento nesta versão — métodos de pagamento sujeitos a disponibilidade.
      </div>

      <div className="payment-methods">
        <button
          className={`payment-method ${selectedMethod === 'balance' ? 'selected' : ''}`}
          onClick={() => handleSelect('balance')}
        >
          <span className="method-icon">💳</span>
          <span className="method-name">Saldo UnifiCard</span>
          <span className="method-description">Pagar com saldo da sua conta</span>
        </button>

        <button
          className={`payment-method ${selectedMethod === 'card' ? 'selected' : ''}`}
          onClick={() => handleSelect('card')}
        >
          <span className="method-icon">💳</span>
          <span className="method-name">Cartão de Crédito/Débito</span>
          <span className="method-description">Pagar com cartão</span>
        </button>

        <button
          className={`payment-method ${selectedMethod === 'invoice' ? 'selected' : ''}`}
          onClick={() => handleSelect('invoice')}
        >
          <span className="method-icon">📄</span>
          <span className="method-name">Fatura (B2B)</span>
          <span className="method-description">Pagar via fatura (empresas)</span>
        </button>
      </div>

      {selectedMethod && (
        <div className="payment-confirm">
          <button className="btn-confirm-method" onClick={handleConfirm}>
            Confirmar Método de Pagamento
          </button>
        </div>
      )}

      {error && (
        <div className="payment-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}


