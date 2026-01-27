// src/components/service-orders/ServiceOrderFinancialTermsModal.tsx
// Modal para visualizar e confirmar termos financeiros de Service Order

import { useState, useEffect } from 'react';
import {
  getServiceOrderFinancialTerms,
  confirmServiceOrderFinancialTerms,
  type ServiceOrderFinancialTerms,
} from '../../api/service-orders';
import { showToast } from '../common/Toast';
import './ServiceOrderFinancialTermsModal.css';

export interface ServiceOrderFinancialTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId: string;
}

export default function ServiceOrderFinancialTermsModal({
  isOpen,
  onClose,
  onSuccess,
  orderId,
}: ServiceOrderFinancialTermsModalProps) {
  const [terms, setTerms] = useState<ServiceOrderFinancialTerms | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadFinancialTerms();
    }
  }, [isOpen, orderId]);

  const loadFinancialTerms = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getServiceOrderFinancialTerms(orderId);
      setTerms(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar termos financeiros');
      showToast(err.message || 'Erro ao carregar termos financeiros', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!terms) return;

    setIsConfirming(true);
    setError(null);

    try {
      await confirmServiceOrderFinancialTerms(orderId);
      showToast('Termos financeiros confirmados com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao confirmar termos financeiros');
      showToast(err.message || 'Erro ao confirmar termos financeiros', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (cents: number, currency: string = 'BRL') => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  return (
    <div className="service-order-financial-terms-modal-overlay" onClick={onClose}>
      <div className="service-order-financial-terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="service-order-financial-terms-modal-header">
          <h2>Termos Financeiros</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="service-order-financial-terms-modal-content">
          {isLoading ? (
            <div className="loading">Carregando termos financeiros...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : terms ? (
            <>
              <div className="financial-warning">
                <strong>⚠️ Aviso de Comissão</strong>
                <p>
                  A plataforma cobra {terms.platformFeePercentage}% de comissão sobre o valor bruto do serviço.
                  Este valor será deduzido do pagamento ao prestador.
                </p>
              </div>

              <div className="financial-summary">
                <h3>Resumo Financeiro</h3>
                
                <div className="financial-item">
                  <span className="label">Valor Bruto:</span>
                  <span className="value">{formatCurrency(terms.grossAmount, terms.currency)}</span>
                </div>

                <div className="financial-item fee">
                  <span className="label">
                    Comissão da Plataforma ({terms.platformFeePercentage}%):
                  </span>
                  <span className="value negative">
                    - {formatCurrency(terms.platformFee, terms.currency)}
                  </span>
                </div>

                <div className="financial-item net">
                  <span className="label">Valor Líquido do Prestador:</span>
                  <span className="value positive">
                    {formatCurrency(terms.providerNetAmount, terms.currency)}
                  </span>
                </div>
              </div>

              <div className="financial-actions">
                <button
                  className="btn-cancel"
                  onClick={onClose}
                  disabled={isConfirming}
                >
                  Fechar
                </button>
                <button
                  className="btn-confirm"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? 'Confirmando...' : 'Confirmar Termos Financeiros'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}




