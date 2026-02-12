// src/components/events/guided-flow/Step4SpaceRequirements.tsx
// ETAPA 4 — Onde (Requisitos de Espaço)
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Tipo de espaço (casa, salão, buffet)
// - Escala (pequena / média / grande)
// - Restrições
// - NÃO é local escolhido, é requisito de espaço

import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step4SpaceRequirements.css';

interface Step4SpaceRequirementsProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
}

export default function Step4SpaceRequirements({ data, onUpdate, onComplete }: Step4SpaceRequirementsProps) {
  return (
    <div className="step4-space-requirements">
      <div className="step-header">
        <h2>Onde (Requisitos de Espaço)</h2>
        <p className="step-hint">
          ⚠️ Estes são requisitos, não um local escolhido.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label className="form-label">Tipo de Espaço Necessário</label>
          <div className="option-grid">
            <button
              type="button"
              className={`option-button ${data.space_type === 'home' ? 'selected' : ''}`}
              onClick={() => onUpdate({ space_type: 'home' })}
            >
              Casa
            </button>
            <button
              type="button"
              className={`option-button ${data.space_type === 'venue' ? 'selected' : ''}`}
              onClick={() => onUpdate({ space_type: 'venue' })}
            >
              Salão
            </button>
            <button
              type="button"
              className={`option-button ${data.space_type === 'buffet' ? 'selected' : ''}`}
              onClick={() => onUpdate({ space_type: 'buffet' })}
            >
              Buffet
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Escala</label>
          <div className="option-grid">
            <button
              type="button"
              className={`option-button ${data.scale === 'small' ? 'selected' : ''}`}
              onClick={() => onUpdate({ scale: 'small' })}
            >
              Pequena
            </button>
            <button
              type="button"
              className={`option-button ${data.scale === 'medium' ? 'selected' : ''}`}
              onClick={() => onUpdate({ scale: 'medium' })}
            >
              Média
            </button>
            <button
              type="button"
              className={`option-button ${data.scale === 'large' ? 'selected' : ''}`}
              onClick={() => onUpdate({ scale: 'large' })}
            >
              Grande
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Restrições (opcional)</label>
          <textarea
            value={data.restrictions || ''}
            onChange={(e) => onUpdate({ restrictions: e.target.value || null })}
            placeholder="Ex: Acessibilidade, estacionamento..."
            rows={3}
            className="form-textarea"
          />
        </div>
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onComplete}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

