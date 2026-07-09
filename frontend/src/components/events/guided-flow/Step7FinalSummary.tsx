// src/components/events/guided-flow/Step7FinalSummary.tsx
// ETAPA 7 — Resumo Final
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Resumo completo
// - Aviso claro: "Nada foi pago, reservado ou contratado."
// - CTA permitido: "Avançar para fase econômica"
// - CTA proibido: "Finalizar evento", "Criar evento", "Confirmar"

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import { getOperationalNeeds, type OperationalNeed } from '../../../api/events';
import './Step7FinalSummary.css';

interface Step7FinalSummaryProps {
  data: GuidedFlowData;
  onComplete: () => void;
  onAdvanceToEconomic: () => void;
}

export default function Step7FinalSummary({ data, onAdvanceToEconomic }: Step7FinalSummaryProps) {
  // F-EVENT-ORCHESTRATION-PHASE-B-WRITE: necessidades vêm do backend (event_operational_needs), não do
  // operational_roles morto. Governadas por concept_id.
  const [needs, setNeeds] = useState<OperationalNeed[]>([]);
  useEffect(() => {
    if (!data.event_id) return;
    let live = true;
    getOperationalNeeds(data.event_id).then((n) => { if (live) setNeeds(n); }).catch(() => { if (live) setNeeds([]); });
    return () => { live = false; };
  }, [data.event_id]);
  return (
    <div className="step7-final-summary">
      <div className="step-header">
        <h2>Resumo Final</h2>
        <p className="step-hint">
          Revise o rascunho do seu evento antes de avançar.
        </p>
      </div>

      <div className="step-content">
        <div className="summary-section">
          <h3>Declaração</h3>
          <p><strong>Título:</strong> {data.title || 'Não definido'}</p>
          <p><strong>Descrição:</strong> {data.description || 'Não definida'}</p>
          <p><strong>Tipo:</strong> {data.event_type || 'Não definido'}</p>
          {data.event_subtype && <p><strong>Subtipo:</strong> {data.event_subtype}</p>}
        </div>

        <div className="summary-section">
          <h3>Janelas de Tempo Possíveis</h3>
          {data.desired_time_windows.length > 0 ? (
            <ul>
              {data.desired_time_windows.map((window, index) => (
                <li key={index}>
                  {new Date(window.start_datetime).toLocaleString()} - {new Date(window.end_datetime).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma janela definida</p>
          )}
          {data.flexibility_level && (
            <p><strong>Flexibilidade:</strong> {data.flexibility_level}</p>
          )}
        </div>

        <div className="summary-section">
          <h3>Requisitos de Espaço</h3>
          <p><strong>Tipo:</strong> {data.space_type || 'Não definido'}</p>
          <p><strong>Escala:</strong> {data.scale || 'Não definida'}</p>
          {data.restrictions && <p><strong>Restrições:</strong> {data.restrictions}</p>}
        </div>

        <div className="summary-section">
          <h3>Necessidades operacionais</h3>
          {needs.length > 0 ? (
            <ul>
              {needs.map((n) => (
                <li key={n.needConceptId}><strong>{n.label}</strong></li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma necessidade selecionada</p>
          )}
        </div>

        {data.economic_preview && (
          <div className="summary-section">
            <h3>Preview Econômico (TEST)</h3>
            <p>
              <strong>Status:</strong> {data.economic_preview.status}
              <br />
              <strong>Moeda:</strong> {data.economic_preview.currency || 'TEST'}
            </p>
            {data.economic_preview.notes && (
              <p className="preview-notes">{data.economic_preview.notes}</p>
            )}
          </div>
        )}

        <div className="warning-box-large">
          <h3>⚠️ Aviso Importante</h3>
          <p>
            <strong>Nada foi pago, reservado ou contratado.</strong>
            <br />
            Este é apenas um rascunho declarativo. Para avançar para a fase econômica,
            você poderá criar custódia, calcular split e autorizar pagamentos.
            Nenhuma execução ocorre automaticamente.
          </p>
        </div>
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onAdvanceToEconomic}
        >
          Avançar para Fase Econômica (sem execução)
        </button>
        <p className="cta-auxiliary-text">
          A fase econômica não executa pagamentos automaticamente.
          Nenhum valor será cobrado sem autorizações explícitas.
        </p>
      </div>
    </div>
  );
}

