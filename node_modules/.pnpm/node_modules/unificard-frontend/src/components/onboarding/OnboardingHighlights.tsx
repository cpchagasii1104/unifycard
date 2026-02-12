// src/components/onboarding/OnboardingHighlights.tsx
// Highlights sutis para guiar novos usuários

import { useState, useEffect } from 'react';
import './OnboardingHighlights.css';

const ONBOARDING_COMPLETED_KEY = 'unificard_onboarding_completed';
const HIGHLIGHTS_DISMISSED_KEY = 'unificard_highlights_dismissed';

interface OnboardingHighlightsProps {
  targetId: string;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function OnboardingHighlight({ 
  targetId, 
  message, 
  position = 'bottom',
  delay = 0 
}: OnboardingHighlightsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Verificar se onboarding foi completado ou highlights foram dispensados
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    const dismissed = localStorage.getItem(HIGHLIGHTS_DISMISSED_KEY);
    
    if (completed !== 'true' || dismissed === 'true') {
      return;
    }

    // Aguardar delay antes de mostrar
    const timer = setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        setTargetElement(element);
        setIsVisible(true);
        
        // Scroll suave até o elemento se necessário
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [targetId, delay]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(HIGHLIGHTS_DISMISSED_KEY, 'true');
  };

  if (!isVisible || !targetElement) {
    return null;
  }

  const rect = targetElement.getBoundingClientRect();
  const highlightStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  // Posicionar highlight baseado na posição especificada
  switch (position) {
    case 'top':
      highlightStyle.top = `${rect.top - 60}px`;
      highlightStyle.left = `${rect.left + rect.width / 2}px`;
      highlightStyle.transform = 'translateX(-50%)';
      break;
    case 'bottom':
      highlightStyle.top = `${rect.bottom + 10}px`;
      highlightStyle.left = `${rect.left + rect.width / 2}px`;
      highlightStyle.transform = 'translateX(-50%)';
      break;
    case 'left':
      highlightStyle.top = `${rect.top + rect.height / 2}px`;
      highlightStyle.left = `${rect.left - 10}px`;
      highlightStyle.transform = 'translateY(-50%)';
      break;
    case 'right':
      highlightStyle.top = `${rect.top + rect.height / 2}px`;
      highlightStyle.left = `${rect.right + 10}px`;
      highlightStyle.transform = 'translateY(-50%)';
      break;
  }

  return (
    <div className="onboarding-highlight" style={highlightStyle}>
      <div className="highlight-arrow" data-position={position} />
      <div className="highlight-content">
        <p className="highlight-message">{message}</p>
        <button className="highlight-dismiss" onClick={handleDismiss}>
          ✕
        </button>
      </div>
    </div>
  );
}

// Hook para verificar se deve mostrar highlights
export function useOnboardingHighlights() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    const dismissed = localStorage.getItem(HIGHLIGHTS_DISMISSED_KEY);
    
    // Mostrar highlights apenas se onboarding foi completado mas highlights não foram dispensados
    setShouldShow(completed === 'true' && dismissed !== 'true');
  }, []);

  return shouldShow;
}


