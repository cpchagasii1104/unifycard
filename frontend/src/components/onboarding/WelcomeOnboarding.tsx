// src/components/onboarding/WelcomeOnboarding.tsx
// Tela de boas-vindas para novos usuários

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WelcomeOnboarding.css';

const ONBOARDING_COMPLETED_KEY = 'unificard_onboarding_completed';

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

export default function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se já completou onboarding
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    if (completed === 'true') {
      onComplete();
      return;
    }

    // Mostrar após pequeno delay para suavizar entrada
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleExploreFeed = () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
      navigate('/social');
    }, 300);
  };

  const handleDiscoverCommunity = () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
      navigate('/grupos');
    }, 300);
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="welcome-onboarding-overlay" onClick={handleSkip}>
      <div 
        className={`welcome-onboarding ${isVisible ? 'visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="welcome-header">
          <div className="welcome-icon">✨</div>
          <h1 className="welcome-title">Bem-vindo ao Unificard!</h1>
          <p className="welcome-subtitle">Sua economia local conectada</p>
        </div>

        <div className="welcome-content">
          <div className="welcome-step">
            <div className="step-icon">🔍</div>
            <h3 className="step-title">Descubra</h3>
            <p className="step-description">
              Explore serviços, eventos e produtos da sua comunidade
            </p>
          </div>

          <div className="welcome-step">
            <div className="step-icon">💚</div>
            <h3 className="step-title">Aja</h3>
            <p className="step-description">
              Cada ação gera impacto real na economia local
            </p>
          </div>

          <div className="welcome-step">
            <div className="step-icon">👥</div>
            <h3 className="step-title">Impacte</h3>
            <p className="step-description">
              Seu dinheiro fortalece comunidades e gera valor coletivo
            </p>
          </div>
        </div>

        <div className="welcome-actions">
          <button
            className="welcome-cta primary"
            onClick={handleExploreFeed}
          >
            Explore o feed
          </button>
          <button
            className="welcome-cta secondary"
            onClick={handleDiscoverCommunity}
          >
            Descubra sua comunidade
          </button>
          <button
            className="welcome-skip"
            onClick={handleSkip}
          >
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}


