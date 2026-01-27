// frontend/src/components/events/wizard/pages/BirthdayActivitiesPage.tsx
// FASE 5 — PÁGINA: Atividades
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayActivitiesPageProps {
  eventSpec: {
    answers?: {
      birthday_profile?: "INFANTIL" | "JOVEM" | "ADULTO" | "TERCEIRA_IDADE" | "NEUTRO";
      activities?: {
        entertainment?: string[];
        food_focus?: boolean;
        special_outfit?: {
          required?: boolean;
          mode?: "COMPRA" | "ALUGUEL" | "NAO_SEI";
        };
      };
    };
  };
  onChange: (partialSpec: {
    activities?: {
      entertainment?: string[];
      food_focus?: boolean;
      special_outfit?: {
        required?: boolean;
        mode?: "COMPRA" | "ALUGUEL" | "NAO_SEI";
      };
    };
  }) => void;
}

/**
 * BirthdayActivitiesPage
 * 
 * Objetivo: Registrar atividades e intenções associadas ao tipo de aniversário
 * Campos EventSpec permitidos:
 * - activities.entertainment[]
 * - activities.food_focus
 * - activities.special_outfit.required
 * - activities.special_outfit.mode
 * 
 * Observações:
 * - Vocabulário fechado conforme EventSpec
 * - Nenhuma atividade implica contratação
 * - Nenhuma atividade cria obrigação
 * - Condicionais por birthday_profile → somente para mostrar opções
 * - ❌ Não mapear perfil → atividade automaticamente
 * - ❌ Não marcar nada por default
 */
export default function BirthdayActivitiesPage({ eventSpec, onChange }: BirthdayActivitiesPageProps) {
  const profile = eventSpec.answers?.birthday_profile;
  const [activities, setActivities] = useState<{
    entertainment?: string[];
    food_focus?: boolean;
    special_outfit?: {
      required?: boolean;
      mode?: "COMPRA" | "ALUGUEL" | "NAO_SEI";
    };
  }>(eventSpec.answers?.activities || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ activities });
  }, [activities, onChange]);

  // Vocabulário fechado por perfil (somente para mostrar opções, não para inferir)
  const getActivitiesByProfile = (): readonly string[] => {
    if (profile === 'INFANTIL') {
      return ['BRINQUEDOS', 'PISCINA_DE_BOLINHAS', 'RECREADOR', 'PERSONAGENS', 'APENAS_BOLO_COMIDA', 'NAO_SEI'] as const;
    } else if (profile === 'JOVEM') {
      return ['DJ', 'BANDA', 'COREOGRAFIA', 'ROUPA_ESPECIAL', 'DECORACAO_TEMATICA', 'ALGO_SIMPLES', 'NAO_SEI'] as const;
    } else if (profile === 'ADULTO') {
      return ['BEBIDAS', 'MUSICA_AMBIENTE', 'MUSICA_AO_VIVO', 'CONFRATERNIZACAO_SIMPLES', 'NAO_SEI'] as const;
    } else if (profile === 'TERCEIRA_IDADE') {
      return ['MUSICA_AMBIENTE', 'EVENTO_TRANQUILO', 'ACESSIBILIDADE', 'NAO_SEI'] as const;
    }
    // NEUTRO ou não definido: mostrar todas as opções
    return ['BRINQUEDOS', 'PISCINA_DE_BOLINHAS', 'RECREADOR', 'PERSONAGENS', 'DJ', 'BANDA', 'COREOGRAFIA', 'ROUPA_ESPECIAL', 'DECORACAO_TEMATICA', 'BEBIDAS', 'MUSICA_AMBIENTE', 'MUSICA_AO_VIVO', 'CONFRATERNIZACAO_SIMPLES', 'EVENTO_TRANQUILO', 'ACESSIBILIDADE', 'NAO_SEI'] as const;
  };

  const availableActivities = getActivitiesByProfile();
  const hasSpecialOutfit = activities.entertainment?.includes('ROUPA_ESPECIAL');
  const isAdult = profile === 'ADULTO';
  const isElderly = profile === 'TERCEIRA_IDADE';

  return (
    <div className="wizard-page">
      <h3>Atividades</h3>
      <p className="step-description">
        Quais atividades você deseja ter na festa? Lista de intenções, não implica contratação.
      </p>

      {/* COMIDA_COMO_FOCO (apenas para ADULTO) - mapeado para food_focus */}
      {isAdult && (
        <div className="form-group">
          <label className="form-label">
            Comida como foco <span className="optional">(opcional)</span>
          </label>
          <div className="yes-no-buttons">
            <button
              type="button"
              className={`yes-no-button ${activities.food_focus === true ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({ ...prev, food_focus: true }))}
            >
              Sim
            </button>
            <button
              type="button"
              className={`yes-no-button ${activities.food_focus === false ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({ ...prev, food_focus: false }))}
            >
              Não
            </button>
          </div>
        </div>
      )}

      {/* ALIMENTACAO_LEVE (apenas para TERCEIRA_IDADE) - mapeado para food_focus */}
      {isElderly && (
        <div className="form-group">
          <label className="form-label">
            Alimentação leve <span className="optional">(opcional)</span>
          </label>
          <div className="yes-no-buttons">
            <button
              type="button"
              className={`yes-no-button ${activities.food_focus === true ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({ ...prev, food_focus: true }))}
            >
              Sim
            </button>
            <button
              type="button"
              className={`yes-no-button ${activities.food_focus === false ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({ ...prev, food_focus: false }))}
            >
              Não
            </button>
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">
          Atividades desejadas <span className="optional">(opcional)</span>
        </label>
        <div className="checkbox-grid">
          {availableActivities.map(activity => (
            <label key={activity} className="checkbox-option">
              <input
                type="checkbox"
                checked={activities.entertainment?.includes(activity) || false}
                onChange={(e) => {
                  const current = activities.entertainment || [];
                  const updated = e.target.checked
                    ? [...current, activity]
                    : current.filter(a => a !== activity);
                  setActivities(prev => ({
                    ...prev,
                    entertainment: updated.length > 0 ? updated : undefined,
                    // Se desmarcar ROUPA_ESPECIAL, limpar special_outfit
                    special_outfit: (activity === 'ROUPA_ESPECIAL' && !e.target.checked)
                      ? undefined
                      : prev.special_outfit,
                  }));
                }}
              />
              <span>{activity.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Se marcar "ROUPA_ESPECIAL" (apenas para JOVEM) */}
      {hasSpecialOutfit && profile === 'JOVEM' && (
        <div className="form-group">
          <label className="form-label">
            Modo da roupa especial <span className="optional">(opcional)</span>
          </label>
          <div className="option-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button
              type="button"
              className={`option-card ${activities.special_outfit?.mode === 'COMPRA' ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({
                ...prev,
                special_outfit: {
                  required: true,
                  mode: 'COMPRA',
                }
              }))}
            >
              <div className="option-label">Compra</div>
            </button>
            <button
              type="button"
              className={`option-card ${activities.special_outfit?.mode === 'ALUGUEL' ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({
                ...prev,
                special_outfit: {
                  required: true,
                  mode: 'ALUGUEL',
                }
              }))}
            >
              <div className="option-label">Aluguel</div>
            </button>
            <button
              type="button"
              className={`option-card ${activities.special_outfit?.mode === 'NAO_SEI' ? 'selected' : ''}`}
              onClick={() => setActivities(prev => ({
                ...prev,
                special_outfit: {
                  required: true,
                  mode: 'NAO_SEI',
                }
              }))}
            >
              <div className="option-label">Não sei</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

