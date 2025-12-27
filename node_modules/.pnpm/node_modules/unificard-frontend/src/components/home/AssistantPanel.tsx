// src/components/home/AssistantPanel.tsx
// Painel lateral direito do assistente virtual

import { useNavigate } from 'react-router-dom';
import './AssistantPanel.css';

export default function AssistantPanel() {
  const navigate = useNavigate();

  const handleViewExamples = () => {
    navigate('/social');
  };

  const handleQuickAction = () => {
    navigate('/social');
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-panel-header">
        <h3 className="assistant-panel-title">Assistente</h3>
        <button className="assistant-panel-mic" type="button" aria-label="Microfone">
          🎤
        </button>
      </div>
      
      <div className="assistant-panel-content">
        <div className="assistant-panel-message">
          <p>Diga o que você precisa. Eu resolvo.</p>
        </div>
        
        <div className="assistant-panel-avatar">
          <div className="assistant-avatar">🤖</div>
        </div>

        <div className="assistant-panel-actions">
          <button 
            className="assistant-quick-action"
            onClick={handleQuickAction}
          >
            <span className="action-icon">🍕</span>
            <span className="action-text">Pedir comida para agora</span>
          </button>
          <button 
            className="assistant-quick-action"
            onClick={handleQuickAction}
          >
            <span className="action-icon">📅</span>
            <span className="action-text">Ver atividades de hoje</span>
          </button>
        </div>

        <button 
          className="assistant-explore-button"
          onClick={handleViewExamples}
        >
          Explorar opções →
        </button>
      </div>
    </div>
  );
}

