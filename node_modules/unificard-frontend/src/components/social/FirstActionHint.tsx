// src/components/social/FirstActionHint.tsx
// Bloco de dica para primeira ação do usuário no feed

import { useState, useEffect } from 'react';
import './FirstActionHint.css';

const FIRST_ACTION_COMPLETED_KEY = 'unificard_first_action_completed';

interface FirstActionHintProps {
  onViewServices: () => void;
  onCreatePost: () => void;
}

export default function FirstActionHint({ onViewServices, onCreatePost }: FirstActionHintProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verificar se usuário já completou primeira ação
    const completed = localStorage.getItem(FIRST_ACTION_COMPLETED_KEY);
    if (completed !== 'true') {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(FIRST_ACTION_COMPLETED_KEY, 'true');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="first-action-hint">
      <div className="hint-content">
        <div className="hint-header">
          <span className="hint-icon">✨</span>
          <div className="hint-text">
            <h3 className="hint-title">Comece agora!</h3>
            <p className="hint-description">
              Contrate um serviço local ou crie sua primeira publicação para começar a gerar impacto.
            </p>
          </div>
          <button
            className="hint-dismiss"
            onClick={handleDismiss}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        
        <div className="hint-actions">
          <button
            className="hint-action-btn hint-action-services"
            onClick={() => {
              onViewServices();
              handleDismiss();
            }}
          >
            <span className="action-icon">🛠️</span>
            <span className="action-label">Ver serviços perto de mim</span>
          </button>
          
          <button
            className="hint-action-btn hint-action-create"
            onClick={() => {
              onCreatePost();
              handleDismiss();
            }}
          >
            <span className="action-icon">✍️</span>
            <span className="action-label">Criar minha primeira publicação</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Função utilitária para marcar primeira ação como completa
export function markFirstActionCompleted() {
  localStorage.setItem(FIRST_ACTION_COMPLETED_KEY, 'true');
}

// Função utilitária para verificar se primeira ação foi completada
export function hasCompletedFirstAction(): boolean {
  return localStorage.getItem(FIRST_ACTION_COMPLETED_KEY) === 'true';
}


