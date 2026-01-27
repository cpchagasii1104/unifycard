// frontend/src/components/events/wizard/pages/BirthdayStyleThemePage.tsx
// FASE 5 — PÁGINA: Estilo e Tema
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayStyleThemePageProps {
  eventSpec: {
    answers?: {
      style?: {
        general?: "SIMPLES" | "ANIMADA" | "SOFISTICADA" | "TEMATICA" | "INDEFINIDA";
        theme?: string;
      };
    };
  };
  onChange: (partialSpec: {
    style?: {
      general?: "SIMPLES" | "ANIMADA" | "SOFISTICADA" | "TEMATICA" | "INDEFINIDA";
      theme?: string;
    };
  }) => void;
}

/**
 * BirthdayStyleThemePage
 * 
 * Objetivo: Coletar estilo geral e eventual tema da festa
 * Campos EventSpec permitidos:
 * - style.general
 * - style.theme
 * 
 * Regras duras:
 * - Tema nunca cria serviço
 * - Tema nunca cria fornecedor
 * - Tema apenas classifica contexto
 */
export default function BirthdayStyleThemePage({ eventSpec, onChange }: BirthdayStyleThemePageProps) {
  const [style, setStyle] = useState<{
    general?: "SIMPLES" | "ANIMADA" | "SOFISTICADA" | "TEMATICA" | "INDEFINIDA";
    theme?: string;
  }>(eventSpec.answers?.style || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ style });
  }, [style, onChange]);

  const isThematic = style.general === 'TEMATICA';

  return (
    <div className="wizard-page">
      <h3>Estilo e Tema</h3>
      <p className="step-description">
        Como você imagina essa festa? Tema NUNCA cria serviço, apenas classifica contexto.
      </p>

      <div className="form-group">
        <label className="form-label">
          Como você imagina essa festa? <span className="required">*</span>
        </label>
        <div className="option-grid">
          {(['SIMPLES', 'ANIMADA', 'SOFISTICADA', 'TEMATICA', 'INDEFINIDA'] as const).map(styleOption => (
            <button
              key={styleOption}
              type="button"
              className={`option-card ${style.general === styleOption ? 'selected' : ''}`}
              onClick={() => setStyle(prev => ({
                ...prev,
                general: styleOption,
                // Limpar tema se não for temática
                theme: styleOption === 'TEMATICA' ? prev.theme : undefined,
              }))}
            >
              <div className="option-label">{styleOption.replace('_', ' ')}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tema da festa (CONDICIONAL - apenas se general = TEMATICA) */}
      {isThematic && (
        <div className="form-group">
          <label htmlFor="theme" className="form-label">
            Tema da festa <span className="optional">(opcional)</span>
          </label>
          <input
            id="theme"
            type="text"
            value={style.theme || ''}
            onChange={(e) => setStyle(prev => ({
              ...prev,
              theme: e.target.value || undefined,
            }))}
            placeholder="Ex: Super-heróis, Princesas, Vintage, etc."
            className="form-input"
          />
          <p className="field-hint">
            ⚠️ Tema NUNCA cria serviço. Tema apenas classifica contexto.
          </p>
          <button
            type="button"
            className="link-button"
            onClick={() => setStyle(prev => ({ ...prev, theme: undefined }))}
          >
            Ainda não sei
          </button>
        </div>
      )}
    </div>
  );
}

