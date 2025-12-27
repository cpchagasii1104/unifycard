// src/components/WorkCheckoutInfo.tsx
// Componente para exibir informação sobre o Fundo Regional no checkout do WORK

import './WorkCheckoutInfo.css';

interface WorkCheckoutInfoProps {
  amount?: number;
  showTooltip?: boolean;
}

export default function WorkCheckoutInfo({ amount, showTooltip = false }: WorkCheckoutInfoProps) {
  const fundAmount = amount ? (amount * 0.1).toFixed(2) : null;

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="work-checkout-info">
      <div className="checkout-info-content">
        <span className="checkout-info-icon">💚</span>
        <span className="checkout-info-text">
          10% do valor deste serviço vai para o Fundo Regional da sua cidade.
          {fundAmount && (
            <span className="checkout-info-amount">
              {' '}({formatCurrency(parseFloat(fundAmount))})
            </span>
          )}
        </span>
        {showTooltip && (
          <div className="checkout-info-tooltip">
            O Fundo Regional é um cofre coletivo que recebe parte de cada serviço para fortalecer a economia local.
          </div>
        )}
      </div>
    </div>
  );
}

