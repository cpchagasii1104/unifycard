// src/components/events/guided-flow/Step1Declaration.tsx
// ETAPA 1 — Declaração Inicial (CRIA RASCUNHO)
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Chama POST /events/v2/create
// - Backend retorna event_id e status: draft
// - Frontend guarda event_id e avança fluxo

import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step1Declaration.css';

interface Step1DeclarationProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
  isLoading: boolean;
}

export default function Step1Declaration({ data, onUpdate, onComplete, isLoading }: Step1DeclarationProps) {
  return (
    <div className="step1-declaration">
      <div className="step-header">
        <h2>Declaração Inicial</h2>
        <p className="step-hint">
          Vamos criar um rascunho do seu evento. Nada será confirmado ainda.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label className="form-label">Título do Rascunho</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Ex: Festa de Aniversário"
            className="form-input"
          />
        </div>

        <div className="info-box">
          <p>
            <strong>Status:</strong> Rascunho será criado após continuar.
            <br />
            <strong>Event ID:</strong> {data.event_id || 'Será gerado após continuar'}
          </p>
        </div>
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onComplete}
          disabled={!data.title.trim() || isLoading}
        >
          {isLoading ? 'Criando rascunho...' : 'Criar Rascunho'}
        </button>
      </div>
    </div>
  );
}

