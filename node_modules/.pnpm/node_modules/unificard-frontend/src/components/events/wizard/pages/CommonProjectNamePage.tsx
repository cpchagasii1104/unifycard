// frontend/src/components/events/wizard/pages/CommonProjectNamePage.tsx
// FASE 5 — PÁGINA COMUM: Nome do Evento
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface CommonProjectNamePageProps {
  eventSpec: {
    answers?: {
      project_name?: string;
    };
  };
  onChange: (partialSpec: { project_name: string }) => void;
}

/**
 * CommonProjectNamePage
 * 
 * Objetivo: Capturar o nome humano do evento
 * Campos EventSpec permitidos: project_name
 * Restrições: Campo obrigatório, texto livre, nunca gera regra
 */
export default function CommonProjectNamePage({ eventSpec, onChange }: CommonProjectNamePageProps) {
  const [projectName, setProjectName] = useState<string>(
    eventSpec.answers?.project_name || ''
  );

  // Notificar mudanças via onChange
  useEffect(() => {
    if (projectName.trim().length > 0) {
      onChange({ project_name: projectName.trim() });
    }
  }, [projectName, onChange]);

  return (
    <div className="wizard-page">
      <h3>Nome do Evento</h3>
      <p className="step-description">
        Como você quer chamar este evento? (Ex: Festa de Aniversário do João)
      </p>
      <div className="form-group">
        <label htmlFor="project_name" className="form-label">
          Nome do evento / projeto <span className="required">*</span>
        </label>
        <input
          id="project_name"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Ex: Festa de Aniversário do João"
          className="form-input"
          required
        />
        <p className="field-hint">
          Este nome serve apenas para identificação humana. Pode ser editado no futuro.
        </p>
      </div>
    </div>
  );
}

