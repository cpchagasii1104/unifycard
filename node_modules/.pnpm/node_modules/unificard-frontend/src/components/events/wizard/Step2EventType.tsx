// src/components/events/wizard/Step2EventType.tsx
// Step 2: "O que você quer que aconteça?" - Cards de intenções com limites por Actor
// ATUALIZADO: 29/12/2024 - Regras de Actor implementadas
// ATUALIZADO: 17/01/2026 - Adicionada seleção de subtipo específico antes de prosseguir

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WizardData } from '../EventCreationWizard';
import { 
  getAvailableIntentions, 
  intentionToEventType,
  getIntentionLimit,
  type Intention 
} from './intentionMapping';
import { 
  getSubtypesForIntention, 
  requiresSubtypeSelection,
  type EventSubtypeOption 
} from './eventSubtypeMapping';
import './Step2EventType.css';

interface Step2EventTypeProps {
  data: WizardData;
  actorType: 'user' | 'page';
  onUpdate: (updates: Partial<WizardData>) => void;
}

export default function Step2EventType({ data, actorType, onUpdate }: Step2EventTypeProps) {
  const navigate = useNavigate();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showCustomCelebrationInput, setShowCustomCelebrationInput] = useState(false);
  const [customCelebrationText, setCustomCelebrationText] = useState('');

  const availableIntentions = getAvailableIntentions(actorType);
  const selectedIntention = availableIntentions.find(
    card => card.eventType === data.event_type
  )?.id;

  // Determinar intenção selecionada baseado em data.event_type (READ-MODEL)
  const selectedIntentionId: Intention | null = selectedIntention || null;

  const handleIntentionSelect = (intentionId: Intention) => {
    const eventType = intentionToEventType(intentionId);
    const limit = getIntentionLimit(intentionId, actorType);
    
    // Se a intenção requer seleção de subtipo, apenas definir event_type
    // O subtipo será selecionado na próxima renderização
    if (requiresSubtypeSelection(intentionId)) {
      onUpdate({
        event_type: eventType,
        event_subtype: null, // Será definido na próxima etapa
        custom_subtype_text: null,
        max_attendees: limit?.maxAttendees ?? null,
      });
    } else {
      // Se não requer, usar o subtipo padrão
      const subtypes = getSubtypesForIntention(intentionId);
      onUpdate({
        event_type: eventType,
        event_subtype: subtypes[0]?.value || null,
        custom_subtype_text: null,
        max_attendees: limit?.maxAttendees ?? null,
      });
    }
    setShowCustomInput(false);
  };

  const handleSubtypeSelect = (subtype: EventSubtypeOption) => {
    // Se for "other", mostrar input manual
    if (subtype.value === 'other') {
      setShowCustomCelebrationInput(true);
      setCustomCelebrationText('');
      return;
    }
    
    // Atualizar APENAS event_subtype, mantendo event_type e selectedIntentionId intactos
    onUpdate({
      event_subtype: subtype.value,
    });
  };

  const handleCustomCelebrationSubmit = () => {
    if (customCelebrationText.trim()) {
      // Salvar "other" como event_subtype e o texto livre em custom_subtype_text
      onUpdate({
        event_subtype: 'other',
        custom_subtype_text: customCelebrationText.trim(),
      });
      setShowCustomCelebrationInput(false);
      setCustomCelebrationText('');
    }
  };

  const handleBackFromSubtype = () => {
    // Voltar deve limpar APENAS event_subtype e custom_subtype_text, mantendo event_type
    onUpdate({
      event_subtype: null,
      custom_subtype_text: null,
    });
    // Resetar estado do input customizado se estiver aberto
    setShowCustomCelebrationInput(false);
    setCustomCelebrationText('');
  };

  const handleCustomSubmit = () => {
    if (customText.trim()) {
      onUpdate({
        custom_subtype_text: customText.trim(),
        event_subtype: null, // Backend decide/modera
      });
      setShowCustomInput(false);
      setCustomText('');
    }
  };

  // LÓGICA DE RENDERIZAÇÃO BASEADA EM READ-MODEL (data.event_type e data.event_subtype)
  
  // Se event_type E event_subtype já existem: mostrar confirmação
  if (data.event_type && data.event_subtype) {
    const selectedIntentionCard = availableIntentions.find(c => c.id === selectedIntentionId);
    const subtypes = selectedIntentionId ? getSubtypesForIntention(selectedIntentionId) : [];
    const selectedSubtype = subtypes.find(s => s.value === data.event_subtype);
    
    // Se for "other" e tiver custom_subtype_text, mostrar o texto customizado
    const displaySubtype = data.event_subtype === 'other' && data.custom_subtype_text
      ? data.custom_subtype_text
      : selectedSubtype?.label || data.event_subtype;
    
    return (
      <div className="step-container">
        <h2>Step 2 · Tipo</h2>
        <div className="step-confirmation">
          <div className="confirmation-badge">
            <span className="confirmation-icon">✓</span>
            <span className="confirmation-text">Tipo selecionado</span>
          </div>
          <div className="confirmation-details">
            <div className="confirmation-item">
              <span className="confirmation-label">Intenção:</span>
              <span className="confirmation-value">{selectedIntentionCard?.label}</span>
            </div>
            <div className="confirmation-item">
              <span className="confirmation-label">Tipo específico:</span>
              <span className="confirmation-value">{displaySubtype}</span>
            </div>
          </div>
          <button
            className="change-selection-button"
            onClick={handleBackFromSubtype}
          >
            Alterar tipo específico
          </button>
        </div>
      </div>
    );
  }

  // Se event_type existe mas event_subtype não: mostrar seleção de subtipo
  if (data.event_type && selectedIntentionId && requiresSubtypeSelection(selectedIntentionId)) {
    const subtypes = getSubtypesForIntention(selectedIntentionId);
    const selectedIntentionCard = availableIntentions.find(c => c.id === selectedIntentionId);
    
    // Se "other" foi selecionado, mostrar input manual
    if (showCustomCelebrationInput) {
      return (
        <div className="step-container">
          <button
            className="back-to-intentions-button"
            onClick={() => {
              setShowCustomCelebrationInput(false);
              setCustomCelebrationText('');
            }}
          >
            ← Voltar
          </button>
          <h2>Descreva o tipo de celebração</h2>
          <p className="step-description">
            Informe o tipo específico de celebração que não está na lista:
          </p>
          
          <div className="custom-celebration-input">
            <textarea
              className="custom-celebration-textarea"
              value={customCelebrationText}
              onChange={(e) => setCustomCelebrationText(e.target.value)}
              placeholder="Ex: Festa de debutante, Aniversário de 50 anos, etc."
              rows={3}
            />
            <div className="custom-celebration-actions">
              <button
                className="wizard-button wizard-button-secondary"
                onClick={() => {
                  setShowCustomCelebrationInput(false);
                  setCustomCelebrationText('');
                }}
              >
                Cancelar
              </button>
              <button
                className="wizard-button wizard-button-primary"
                onClick={handleCustomCelebrationSubmit}
                disabled={!customCelebrationText.trim()}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="step-container">
        <button
          className="back-to-intentions-button"
          onClick={() => {
            // Voltar deve limpar APENAS event_subtype, mas como não existe ainda,
            // limpar event_type para voltar à seleção de intenções
            onUpdate({ event_type: null, event_subtype: null });
          }}
        >
          ← Voltar
        </button>
        <h2>Qual tipo específico de {selectedIntentionCard?.label.toLowerCase()}?</h2>
        <p className="step-description">
          Selecione o tipo específico para personalizarmos melhor seu evento:
        </p>
        
        <div className="event-subtypes-grid">
          {subtypes.map((subtype) => (
            <button
              key={subtype.value}
              className={`event-subtype-card ${data.event_subtype === subtype.value ? 'selected' : ''}`}
              onClick={() => handleSubtypeSelect(subtype)}
            >
              <div className="event-subtype-icon">{subtype.icon}</div>
              <div className="event-subtype-label">{subtype.label}</div>
              <div className="event-subtype-description">{subtype.description}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="step-container">
      <h2>O que você quer que aconteça?</h2>
      <p className="step-description">
        Escolha o que melhor descreve seu evento:
      </p>

      {/* Indicador de tipo de actor */}
      <div className={`actor-indicator actor-indicator-${actorType}`}>
        {actorType === 'user' ? (
          <>
            <span className="actor-icon">👤</span>
            <span className="actor-label">Criando como Pessoa Física</span>
            <span className="actor-hint">Algumas opções têm limites de participantes</span>
          </>
        ) : (
          <>
            <span className="actor-icon">🏢</span>
            <span className="actor-label">Criando como Empresa</span>
            <span className="actor-hint">Todas as opções disponíveis</span>
          </>
        )}
      </div>

      <div className="event-types-grid">
        {availableIntentions.map(card => {
          const limit = card.limits[actorType];
          return (
            <button
              key={card.id}
              className={`event-type-card ${selectedIntention === card.id ? 'selected' : ''}`}
              onClick={() => handleIntentionSelect(card.id)}
            >
              <div className="event-type-icon">{card.icon}</div>
              <div className="event-type-label">{card.label}</div>
              <div className="event-type-description">{card.description}</div>
              
              {/* Badge de limite (apenas se houver) */}
              {limit?.note && (
                <div className="event-type-limit">
                  {limit.note}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Dica para PF sobre como expandir opções */}
      {actorType === 'user' && (
        <div className="actor-upgrade-hint">
          <span className="hint-icon">💡</span>
          <span className="hint-text">
            Precisa de mais opções? <strong 
              onClick={() => navigate('/empresas')}
              style={{ cursor: 'pointer', color: '#1877f2', textDecoration: 'underline' }}
            >Crie uma empresa</strong> para acessar eventos profissionais, culturais e promocionais.
          </span>
        </div>
      )}

      {!showCustomInput ? (
        <div className="custom-type-section">
          <button
            className="custom-type-button"
            onClick={() => setShowCustomInput(true)}
          >
            Não encontrou sua categoria?
          </button>
        </div>
      ) : (
        <div className="custom-type-input">
          <p className="custom-type-note">
            Descreva o tipo de evento que você deseja criar. Nossa equipe irá revisar e aprovar.
          </p>
          <textarea
            className="custom-type-textarea"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Ex: Encontro de colecionadores de selos..."
            rows={3}
          />
          <div className="custom-type-actions">
            <button
              className="wizard-button wizard-button-secondary"
              onClick={() => {
                setShowCustomInput(false);
                setCustomText('');
              }}
            >
              Cancelar
            </button>
            <button
              className="wizard-button wizard-button-primary"
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
