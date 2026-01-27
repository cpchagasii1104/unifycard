// frontend/src/components/agreements/AgreementSummary.tsx
// Resumo visual do Agreement Draft
// 🔴 BLINDAGEM: Apenas exibe dados do backend, não calcula valores

import { type Agreement } from '../../api/agreements';
import './AgreementSummary.css';

interface AgreementSummaryProps {
  agreement: Agreement;
}

export default function AgreementSummary({ agreement }: AgreementSummaryProps) {
  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  return (
    <div className="agreement-summary">
      <div className="agreement-summary-section">
        <h4>Valor</h4>
        <div className="agreement-price">
          {formatPrice(agreement.priceCents, agreement.currency)}
        </div>
      </div>

      <div className="agreement-summary-section">
        <h4>Escopo</h4>
        <p className="agreement-scope">{agreement.scope}</p>
      </div>

      {agreement.includedItems && agreement.includedItems.length > 0 && (
        <div className="agreement-summary-section">
          <h4>Itens Inclusos</h4>
          <ul className="agreement-items-list">
            {agreement.includedItems.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {agreement.excludedItems && agreement.excludedItems.length > 0 && (
        <div className="agreement-summary-section">
          <h4>Itens Excluídos</h4>
          <ul className="agreement-items-list agreement-items-excluded">
            {agreement.excludedItems.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {agreement.responsibilities && (
        <div className="agreement-summary-section">
          <h4>Responsabilidades</h4>
          <p className="agreement-responsibilities">{agreement.responsibilities}</p>
        </div>
      )}

      {agreement.capacityAssumptions && (
        <div className="agreement-summary-section">
          <h4>Premissas de Capacidade</h4>
          <p className="agreement-capacity">{agreement.capacityAssumptions}</p>
        </div>
      )}

      <div className="agreement-summary-meta">
        <div className="agreement-meta-item">
          <strong>Requerente:</strong> {agreement.requesterActorId.substring(0, 8)}...
        </div>
        <div className="agreement-meta-item">
          <strong>Prestador:</strong> {agreement.providerActorId.substring(0, 8)}...
        </div>
        <div className="agreement-meta-item">
          <strong>Criado em:</strong>{' '}
          {new Date(agreement.createdAt).toLocaleString('pt-BR')}
        </div>
        {agreement.updatedAt && (
          <div className="agreement-meta-item">
            <strong>Atualizado em:</strong>{' '}
            {new Date(agreement.updatedAt).toLocaleString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
}




