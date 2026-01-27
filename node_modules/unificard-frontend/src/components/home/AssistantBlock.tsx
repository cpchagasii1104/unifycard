// src/components/home/AssistantBlock.tsx
// Bloco do assistente virtual

import { useNavigate } from 'react-router-dom';
import './AssistantBlock.css';

export default function AssistantBlock() {
  const navigate = useNavigate();

  const handleStartConversation = () => {
    // Navegar para social feed (onde o assistente pode ser acessado)
    navigate('/social');
  };

  const handleViewExamples = () => {
    // Navegar para social feed com foco em exemplos
    navigate('/social');
  };

  return (
    <div className="assistant-block">
      <div className="assistant-content">
        <div className="assistant-icon">🤖</div>
        <h2 className="assistant-title">Diga o que você precisa. Eu resolvo.</h2>
        <p className="assistant-subtitle">Assistente virtual pronto para ajudar</p>
        <div className="assistant-buttons">
          <button 
            className="assistant-button assistant-button-primary"
            onClick={handleStartConversation}
          >
            Começar conversa
          </button>
          <button 
            className="assistant-button assistant-button-secondary"
            onClick={handleViewExamples}
          >
            Ver exemplos
          </button>
        </div>
      </div>
    </div>
  );
}

