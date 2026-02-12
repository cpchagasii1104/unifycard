// src/components/WorkCheckoutInfo.example.tsx
// EXEMPLO DE USO: Como adicionar o componente WorkCheckoutInfo no checkout do WORK

import WorkCheckoutInfo from './WorkCheckoutInfo';

// Exemplo 1: No checkout/confirmação de pagamento
export function WorkCheckoutExample() {
  const serviceAmount = 100.0; // Valor do serviço

  return (
    <div className="checkout-container">
      <h2>Confirmar Pagamento</h2>
      
      <div className="checkout-summary">
        <p>Valor do serviço: R$ {serviceAmount.toFixed(2)}</p>
        {/* Componente obrigatório do Fundo Regional */}
        <WorkCheckoutInfo amount={serviceAmount} showTooltip={true} />
      </div>

      <button>Confirmar Pagamento</button>
    </div>
  );
}

// Exemplo 2: Versão simples (sem tooltip)
export function WorkCheckoutSimpleExample() {
  return (
    <div className="checkout-container">
      <h2>Confirmar Pagamento</h2>
      
      <div className="checkout-summary">
        {/* Componente obrigatório do Fundo Regional - versão simples */}
        <WorkCheckoutInfo />
      </div>

      <button>Confirmar Pagamento</button>
    </div>
  );
}

