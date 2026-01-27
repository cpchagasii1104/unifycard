// frontend/src/components/compatibility/CompatibilityChecklist.tsx
// Checklist Visual de Compatibilidade Técnica
// 🔴 BLINDAGEM: Exibição clara, sem automação

import type { CompatibilityResult } from '../../types/compatibility';
import './CompatibilityChecklist.css';

interface CompatibilityChecklistProps {
  result: CompatibilityResult;
  showPricing?: boolean;
}

export default function CompatibilityChecklist({
  result,
  showPricing = true,
}: CompatibilityChecklistProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return '✅';
      case 'WARNING':
        return '⚠️';
      case 'BLOCKED':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'OK':
        return 'status-ok';
      case 'WARNING':
        return 'status-warning';
      case 'BLOCKED':
        return 'status-blocked';
      default:
        return '';
    }
  };

  return (
    <div className={`compatibility-checklist ${getStatusClass(result.status)}`}>
      <div className="compatibility-header">
        <h3>
          {getStatusIcon(result.status)} Compatibilidade Técnica
        </h3>
        <span className={`status-badge ${getStatusClass(result.status)}`}>
          {result.status === 'OK' ? 'Compatível' : result.status === 'WARNING' ? 'Atenção' : 'Bloqueado'}
        </span>
      </div>

      {result.status === 'BLOCKED' && (
        <div className="compatibility-blocked">
          <p className="blocked-message">
            ⚠️ Esta combinação não é compatível. Verifique os itens abaixo antes de continuar.
          </p>
        </div>
      )}

      {result.status === 'WARNING' && (
        <div className="compatibility-warning">
          <p className="warning-message">
            ⚠️ Esta combinação tem avisos. Revise antes de confirmar.
          </p>
        </div>
      )}

      {result.capacityMismatch && (
        <div className="compatibility-item blocked">
          <span className="item-icon">❌</span>
          <div className="item-content">
            <strong>Capacidade incompatível</strong>
            <p>O tamanho do evento está fora do range suportado por este setup.</p>
          </div>
        </div>
      )}

      {result.missingRequired.length > 0 && (
        <div className="compatibility-item blocked">
          <span className="item-icon">❌</span>
          <div className="item-content">
            <strong>Itens obrigatórios faltando ({result.missingRequired.length})</strong>
            <ul>
              {result.missingRequired.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result.missingOptional.length > 0 && (
        <div className="compatibility-item warning">
          <span className="item-icon">⚠️</span>
          <div className="item-content">
            <strong>Itens opcionais não disponíveis ({result.missingOptional.length})</strong>
            <ul>
              {result.missingOptional.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result.extraAvailable.length > 0 && (
        <div className="compatibility-item ok">
          <span className="item-icon">✅</span>
          <div className="item-content">
            <strong>Itens extras disponíveis ({result.extraAvailable.length})</strong>
            <ul>
              {result.extraAvailable.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result.requiresProductionAssistance && (
        <div className="compatibility-item warning">
          <span className="item-icon">⚠️</span>
          <div className="item-content">
            <strong>Produção Assistida Obrigatória</strong>
            <p>
              Eventos XL/XXL requerem produção assistida. O booking direto está bloqueado.
              Entre em contato com nossa equipe para contratar este serviço.
            </p>
          </div>
        </div>
      )}

      {showPricing && result.pricing.finalPriceCents && (
        <div className="compatibility-pricing">
          <h4>Precificação</h4>
          {result.pricing.basePriceCents && (
            <div className="pricing-line">
              <span>Preço base:</span>
              <span>R$ {(result.pricing.basePriceCents / 100).toFixed(2)}</span>
            </div>
          )}
          {result.pricing.modifierApplied && result.pricing.modifierApplied !== 1 && (
            <div className="pricing-line">
              <span>Modificador ({result.pricing.modifierApplied}x):</span>
              <span className="modifier">
                {result.pricing.modifierApplied > 1 ? '+' : ''}
                {((result.pricing.modifierApplied - 1) * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="pricing-line final">
            <span>Preço final:</span>
            <strong>R$ {(result.pricing.finalPriceCents / 100).toFixed(2)}</strong>
          </div>
          {result.pricing.reason.length > 0 && (
            <div className="pricing-reasons">
              {result.pricing.reason.map((reason, index) => (
                <p key={index} className="pricing-reason">{reason}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}




