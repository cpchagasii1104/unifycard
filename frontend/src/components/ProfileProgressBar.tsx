// src/components/ProfileProgressBar.tsx
// Barra de progresso do perfil

import { useState, useEffect } from 'react';
import { getProfileProgress, type ProfileProgress } from '../api/profile';
import './ProfileProgressBar.css';

interface ProfileProgressBarProps {
  className?: string;
  showMessage?: boolean;
}

export default function ProfileProgressBar({ className = '', showMessage = true }: ProfileProgressBarProps) {
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProfileProgress();
      setProgress(data);
    } catch (err: any) {
      // 🔴 CORREÇÃO: Em erro (500, timeout ou 401), definir progresso zerado e continuar renderizando
      console.error('[ProfileProgressBar] Erro ao carregar progresso:', err);
      
      // Fallback zerado com mesmo shape esperado
      setProgress({
        progress: 0,
        maxProgressWithoutValidation: 100,
        hasPresentialValidation: false,
        breakdown: {
          personalData: 0,
          professionalProfile: 0,
          physicalProfile: 0,
          learningProfile: 0,
          companies: 0,
          presentialValidation: 0,
        },
        messages: [],
      });
      
      // Não setar error para não bloquear renderização
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`profile-progress-bar ${className}`}>
        <div className="profile-progress-loading">Carregando progresso...</div>
      </div>
    );
  }

  // 🔴 CORREÇÃO: Sempre renderizar mesmo se progress for null (fallback já foi aplicado no catch)
  if (!progress) {
    // Se ainda assim não houver progress, usar fallback zerado
    const fallbackProgress = {
      progress: 0,
      maxProgressWithoutValidation: 100,
      hasPresentialValidation: false,
      breakdown: {
        personalData: 0,
        professionalProfile: 0,
        physicalProfile: 0,
        learningProfile: 0,
        companies: 0,
        presentialValidation: 0,
      },
      messages: [],
    };
    
    const progressPercent = Math.min(fallbackProgress.progress, 100);
    return (
      <div className={`profile-progress-bar ${className}`}>
        <div className="profile-progress-header">
          <span className="profile-progress-label">Progresso do Perfil</span>
          <span className="profile-progress-percent">{progressPercent}%</span>
        </div>
        <div className="profile-progress-container">
          <div 
            className="profile-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(progress.progress, 100);

  return (
    <div className={`profile-progress-bar ${className}`}>
      <div className="profile-progress-header">
        <span className="profile-progress-label">Progresso do Perfil</span>
        <span className="profile-progress-percent">{progressPercent}%</span>
      </div>
      <div className="profile-progress-container">
        <div 
          className="profile-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {showMessage && progress.messages.length > 0 && (
        <div className="profile-progress-message">
          {progress.messages[0]}
        </div>
      )}
    </div>
  );
}




