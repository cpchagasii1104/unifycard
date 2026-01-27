// src/components/home/ContinueBlock.tsx
// Bloco "Continuar de onde parou"

import { useNavigate } from 'react-router-dom';
import type { ContinueItem } from '../../hooks/useHomeData';
import './ContinueBlock.css';

interface ContinueBlockProps {
  continueItems: ContinueItem[];
}

export default function ContinueBlock({ continueItems }: ContinueBlockProps) {
  const navigate = useNavigate();

  const handleContinue = (path: string) => {
    navigate(path);
  };

  // Não renderizar se não houver dados
  if (continueItems.length === 0) {
    return null;
  }

  return (
    <div className="continue-block">
      <h2 className="continue-title">Continuar de onde parou</h2>
      <div className="continue-cards">
        {continueItems.map((item) => (
          <div key={item.id} className="continue-card">
            <div className="continue-card-header">
              <div className="continue-icon">{item.icon}</div>
              <span className="continue-status">{item.status}</span>
            </div>
            <h3 className="continue-card-title">{item.title}</h3>
            <p className="continue-card-description">{item.description}</p>
            <button 
              className="continue-button"
              onClick={() => handleContinue(item.path)}
            >
              Continuar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

