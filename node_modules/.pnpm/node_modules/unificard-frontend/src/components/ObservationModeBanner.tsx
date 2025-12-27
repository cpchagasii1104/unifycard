// src/components/ObservationModeBanner.tsx
// Banner de aviso quando modo observação está ativo (apenas para admin/dev)

import { useState, useEffect } from 'react';
import './ObservationModeBanner.css';

export default function ObservationModeBanner() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Verificar se modo observação está ativo
    // Em produção, isso viria de uma API ou variável de ambiente
    const checkObservationMode = async () => {
      try {
        // Tentar buscar flag do backend (se houver endpoint)
        // Por enquanto, verificar variável de ambiente do frontend
        const enabled = import.meta.env.VITE_OBSERVATION_MODE === 'true';
        setIsEnabled(enabled);
      } catch {
        // Se falhar, verificar variável de ambiente
        setIsEnabled(import.meta.env.VITE_OBSERVATION_MODE === 'true');
      }
    };

    checkObservationMode();
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="observation-mode-banner">
      <div className="banner-content">
        <span className="banner-icon">⚠️</span>
        <div className="banner-text">
          <strong>OBSERVATION MODE ATIVO</strong>
          <span>Nenhuma feature estrutural deve ser adicionada.</span>
        </div>
      </div>
    </div>
  );
}

