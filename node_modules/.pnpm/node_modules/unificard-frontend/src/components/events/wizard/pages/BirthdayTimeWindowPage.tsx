// frontend/src/components/events/wizard/pages/BirthdayTimeWindowPage.tsx
// FASE 5 — PÁGINA: Data e Janela de Tempo
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayTimeWindowPageProps {
  eventSpec: {
    answers?: {
      time_window?: {
        date?: string;
        range?: string;
        start_time?: string;
        end_time?: string;
        flexible?: boolean;
      };
    };
  };
  onChange: (partialSpec: {
    time_window?: {
      date?: string;
      range?: string;
      start_time?: string;
      end_time?: string;
      flexible?: boolean;
    };
  }) => void;
}

/**
 * BirthdayTimeWindowPage
 * 
 * Objetivo: Declarar data e janela de tempo desejada
 * Campos EventSpec permitidos:
 * - time_window.date
 * - time_window.range
 * - time_window.start_time
 * - time_window.end_time
 * - time_window.flexible
 * 
 * Regras duras:
 * - Sempre janela desejada
 * - Nunca agenda fixa
 * - Nunca executável
 * - ❌ Nunca valida disponibilidade
 */
export default function BirthdayTimeWindowPage({ eventSpec, onChange }: BirthdayTimeWindowPageProps) {
  const [timeWindow, setTimeWindow] = useState<{
    date?: string;
    range?: string;
    start_time?: string;
    end_time?: string;
    flexible?: boolean;
  }>(eventSpec.answers?.time_window || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ time_window: timeWindow });
  }, [timeWindow, onChange]);

  return (
    <div className="wizard-page">
      <h3>Data e Horário</h3>
      <p className="step-description">
        Data específica ou janela desejada. Sempre janela desejada, nunca agenda fixa.
      </p>

      <div className="form-group">
        <label htmlFor="time_window_date" className="form-label">
          Data específica <span className="optional">(opcional)</span>
        </label>
        <input
          id="time_window_date"
          type="date"
          value={timeWindow.date || ''}
          onChange={(e) => setTimeWindow(prev => ({
            ...prev,
            date: e.target.value || undefined,
          }))}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="time_window_range" className="form-label">
          Janela de datas <span className="optional">(opcional)</span>
        </label>
        <input
          id="time_window_range"
          type="text"
          value={timeWindow.range || ''}
          onChange={(e) => setTimeWindow(prev => ({
            ...prev,
            range: e.target.value || undefined,
          }))}
          placeholder="Ex: Fim de semana de 15 a 17 de março"
          className="form-input"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="time_window_start_time" className="form-label">
            Horário início <span className="optional">(opcional)</span>
          </label>
          <input
            id="time_window_start_time"
            type="time"
            value={timeWindow.start_time || ''}
            onChange={(e) => setTimeWindow(prev => ({
              ...prev,
              start_time: e.target.value || undefined,
            }))}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="time_window_end_time" className="form-label">
            Horário fim <span className="optional">(opcional)</span>
          </label>
          <input
            id="time_window_end_time"
            type="time"
            value={timeWindow.end_time || ''}
            onChange={(e) => setTimeWindow(prev => ({
              ...prev,
              end_time: e.target.value || undefined,
            }))}
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Flexível ou não? <span className="optional">(opcional)</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${timeWindow.flexible === true ? 'selected' : ''}`}
            onClick={() => setTimeWindow(prev => ({ ...prev, flexible: true }))}
          >
            Sim, flexível
          </button>
          <button
            type="button"
            className={`yes-no-button ${timeWindow.flexible === false ? 'selected' : ''}`}
            onClick={() => setTimeWindow(prev => ({ ...prev, flexible: false }))}
          >
            Não, fixo
          </button>
        </div>
      </div>
    </div>
  );
}

