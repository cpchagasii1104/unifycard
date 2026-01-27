// src/components/events/guided-flow/Step2Description.tsx
// ETAPA 2 — Descrição e Intenção
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Descrição livre
// - Tom do evento (íntimo / familiar / grande)
// - Sem números fechados
// - Chama POST /events/:id/declare

import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step2Description.css';

interface Step2DescriptionProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
}

export default function Step2Description({ data, onUpdate, onComplete }: Step2DescriptionProps) {
  return (
    <div className="step2-description">
      <div className="step-header">
        <h2>Descrição e Intenção</h2>
        <p className="step-hint">
          Descreva o formato do evento e o tom desejado.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea
            value={data.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value || null })}
            placeholder="Descreva o evento..."
            rows={4}
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tom do Evento</label>
          <div className="option-grid">
            <button
              type="button"
              className={`option-button ${data.tone === 'intimate' ? 'selected' : ''}`}
              onClick={() => onUpdate({ tone: 'intimate' })}
            >
              Íntimo
            </button>
            <button
              type="button"
              className={`option-button ${data.tone === 'family' ? 'selected' : ''}`}
              onClick={() => onUpdate({ tone: 'family' })}
            >
              Familiar
            </button>
            <button
              type="button"
              className={`option-button ${data.tone === 'large' ? 'selected' : ''}`}
              onClick={() => onUpdate({ tone: 'large' })}
            >
              Grande
            </button>
          </div>
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

