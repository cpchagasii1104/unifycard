// src/components/events/guided-flow/Step2Description.tsx
// ETAPA 2 — Descrição e Intenção
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Descrição livre
// - Acesso/custo (gratuito/pago/contribuição opcional) — ANÚNCIO, Δbank=0
// - Capacidade (mínimo/máximo de participantes)
// - Substitui o antigo "Tom do Evento" (confundia com a PLATEIA e com visibilidade)

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
          Descreva o evento, o custo e a capacidade.
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
          <label className="form-label">O evento tem custo?</label>
          <div className="option-grid">
            <button type="button" className={`option-button ${data.eventAccessType === 'gratuito' ? 'selected' : ''}`}
              onClick={() => onUpdate({ eventAccessType: 'gratuito', priceReais: '' })}>Gratuito</button>
            <button type="button" className={`option-button ${data.eventAccessType === 'pago' ? 'selected' : ''}`}
              onClick={() => onUpdate({ eventAccessType: 'pago' })}>Pago</button>
            <button type="button" className={`option-button ${data.eventAccessType === 'contribuicao_opcional' ? 'selected' : ''}`}
              onClick={() => onUpdate({ eventAccessType: 'contribuicao_opcional', priceReais: '' })}>Contribuição opcional</button>
          </div>
        </div>

        {data.eventAccessType === 'pago' && (
          <div className="form-group">
            <label className="form-label">Valor anunciado (R$)</label>
            <input type="text" inputMode="decimal" className="form-textarea" placeholder="Ex.: 50,00"
              value={data.priceReais} onChange={(e) => onUpdate({ priceReais: e.target.value })} />
            <p className="step-hint">Pagamentos, estornos e devoluções entram em etapa futura (Bank). Aqui o valor é só anunciado.</p>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Capacidade (opcional)</label>
          <div className="option-grid">
            <input type="number" min={1} className="form-textarea" placeholder="Mínimo de participantes"
              value={data.minAttendees} onChange={(e) => onUpdate({ minAttendees: e.target.value })} />
            <input type="number" min={1} className="form-textarea" placeholder="Máximo de participantes"
              value={data.maxAttendees} onChange={(e) => onUpdate({ maxAttendees: e.target.value })} />
          </div>
          <p className="step-hint">Se você definir um mínimo, o evento pode depender desse número para acontecer.</p>
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

