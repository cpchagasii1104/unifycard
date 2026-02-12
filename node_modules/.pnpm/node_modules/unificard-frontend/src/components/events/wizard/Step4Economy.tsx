// src/components/events/wizard/Step4Economy.tsx
// Step 4: Economia - Visual, sem cálculos

import type { WizardData } from '../EventCreationWizard';
import './Step4Economy.css';

interface Step4EconomyProps {
  data: WizardData;
  actorType: 'user' | 'page';
  onUpdate: (updates: Partial<WizardData>) => void;
}

export default function Step4Economy({ data, actorType, onUpdate }: Step4EconomyProps) {
  const handleEconomyTypeChange = (type: 'free' | 'symbolic' | 'fixed') => {
    onUpdate({ economy_type: type });
    
    if (type === 'free') {
      onUpdate({ ticket_price_cents: null });
    } else if (type === 'symbolic') {
      onUpdate({ ticket_price_cents: 100 }); // R$ 1,00
    } else {
      // fixed - manter valor atual ou 0
      if (!data.ticket_price_cents) {
        onUpdate({ ticket_price_cents: 0 });
      }
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      // Converter para centavos
      const cents = Math.round(value * 100);
      onUpdate({ ticket_price_cents: cents });
    } else {
      onUpdate({ ticket_price_cents: null });
    }
  };

  const handleMaxAttendeesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      onUpdate({ max_attendees: value });
    } else {
      onUpdate({ max_attendees: null });
    }
  };


  return (
    <div className="step-container">
      <h2>Step 4 · Economia</h2>
      <p className="step-description">
        Configure a economia do evento. A distribuição será aplicada automaticamente pelo sistema.
      </p>

      <div className="economy-options">
        <button
          type="button"
          className={`economy-option ${data.economy_type === 'free' ? 'selected' : ''}`}
          onClick={() => handleEconomyTypeChange('free')}
        >
          <div className="economy-icon">🆓</div>
          <div className="economy-label">Gratuito</div>
          <div className="economy-description">Evento sem cobrança</div>
        </button>

        <button
          type="button"
          className={`economy-option ${data.economy_type === 'symbolic' ? 'selected' : ''}`}
          onClick={() => handleEconomyTypeChange('symbolic')}
        >
          <div className="economy-icon">💝</div>
          <div className="economy-label">Valor Simbólico</div>
          <div className="economy-description">R$ 1,00 (sugestão)</div>
        </button>

        <button
          type="button"
          className={`economy-option ${data.economy_type === 'fixed' ? 'selected' : ''}`}
          onClick={() => handleEconomyTypeChange('fixed')}
        >
          <div className="economy-icon">💰</div>
          <div className="economy-label">Valor Fixo</div>
          <div className="economy-description">Defina o valor do ingresso</div>
        </button>
      </div>

      {data.economy_type === 'fixed' && (
        <div className="economy-details">
          <div className="form-group">
            <label htmlFor="ticket_price">
              Valor do Ingresso (R$)
            </label>
            <input
              id="ticket_price"
              type="number"
              step="0.01"
              min="0"
              value={data.ticket_price_cents ? data.ticket_price_cents / 100 : ''}
              onChange={handlePriceChange}
              placeholder="0,00"
            />
          </div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="max_attendees">
          Limite de Público (opcional)
        </label>
        <input
          id="max_attendees"
          type="number"
          min="1"
          value={data.max_attendees || ''}
          onChange={handleMaxAttendeesChange}
          placeholder="Ex: 100"
        />
        <small className="form-help">
          Deixe em branco para sem limite
        </small>
      </div>

      {/* Aviso legal para Pessoa Física com cobrança */}
      {actorType === 'user' && data.economy_type !== 'free' && (
        <div className="legal-warning">
          <div className="legal-warning-icon">⚠️</div>
          <div className="legal-warning-content">
            <strong>Aviso Importante</strong>
            <p>
              Este evento é organizado por pessoa física. 
              A responsabilidade civil é integralmente do organizador. 
              O UnifiCard atua apenas como facilitador de pagamentos.
            </p>
            <label className="legal-checkbox">
              <input 
                type="checkbox" 
                checked={data.accepted_legal_terms || false}
                onChange={(e) => onUpdate({ accepted_legal_terms: e.target.checked })}
              />
              <span>Li e aceito os termos de responsabilidade</span>
            </label>
          </div>
        </div>
      )}

      <div className="economy-preview">
        <p className="preview-note">
          ℹ️ A distribuição de valores será aplicada automaticamente pelo sistema quando o evento for publicado.
        </p>
      </div>
    </div>
  );
}

