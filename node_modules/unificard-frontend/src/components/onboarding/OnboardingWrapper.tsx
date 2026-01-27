// src/components/onboarding/OnboardingWrapper.tsx
// Wrapper que mostra onboarding no primeiro acesso

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import WelcomeOnboarding from './WelcomeOnboarding';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

const ONBOARDING_COMPLETED_KEY = 'unificard_onboarding_completed';
const ONBOARDING_SHOWN_KEY = 'unificard_onboarding_shown';

export default function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Verificar se é primeiro acesso
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    const shown = sessionStorage.getItem(ONBOARDING_SHOWN_KEY);
    
    // Mostrar apenas se:
    // 1. Não completou onboarding
    // 2. Não mostrou nesta sessão
    // 3. Está em uma rota social (não login/register)
    const isSocialRoute = location.pathname.startsWith('/social') || 
                         location.pathname.startsWith('/home') ||
                         location.pathname === '/feed';
    
    if (completed !== 'true' && shown !== 'true' && isSocialRoute) {
      setShowOnboarding(true);
      sessionStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
    }
  }, [location.pathname]);

  if (showOnboarding) {
    return (
      <WelcomeOnboarding
        onComplete={() => {
          setShowOnboarding(false);
        }}
      />
    );
  }

  return <>{children}</>;
}


