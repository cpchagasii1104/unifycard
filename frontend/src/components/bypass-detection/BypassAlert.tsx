// frontend/src/components/bypass-detection/BypassAlert.tsx
// Alerta de Atividade Suspeita Detectada
// 🔴 BLINDAGEM: Apenas exibe estado, não toma decisões

import { useState, useEffect } from 'react';
import { getTrustProfile, type TrustProfile, type RiskLevel } from '../../api/trust';
import './BypassAlert.css';

interface BypassAlertProps {
  actorId: string;
  onDismiss?: () => void;
}

export default function BypassAlert({ actorId, onDismiss }: BypassAlertProps) {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [actorId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await getTrustProfile(actorId);
      setProfile(data);
    } catch (err) {
      console.error('Erro ao carregar trust profile:', err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profile) {
    return null;
  }

  // Mostrar alerta apenas para HIGH ou BLOCKED (indicam atividade suspeita)
  if (profile.riskLevel !== 'high' && profile.riskLevel !== 'critical') {
    return null;
  }

  // Verificar se há eventos negativos recentes (indicam bypass)
  const hasRecentNegativeEvents = profile.negativeEvents > 0;

  if (!hasRecentNegativeEvents) {
    return null;
  }

  const getAlertMessage = (riskLevel: RiskLevel) => {
    if (riskLevel === 'critical') {
      return {
        title: '⚠️ Atividade Suspeita Detectada',
        message:
          'Este perfil foi bloqueado devido a tentativas de burlar o sistema. Entre em contato com o suporte para mais informações.',
        type: 'blocked',
      };
    }

    return {
      title: '⚠️ Atividade Suspeita Detectada',
      message:
        'Foram detectadas tentativas de fechar acordos fora da plataforma ou burlar valores acordados. Todas as transações devem ser feitas dentro da plataforma.',
      type: 'warning',
    };
  };

  const alertInfo = getAlertMessage(profile.riskLevel);

  return (
    <div className={`bypass-alert bypass-alert-${alertInfo.type}`}>
      <div className="bypass-alert-icon">
        {alertInfo.type === 'blocked' ? '🚫' : '⚠️'}
      </div>
      <div className="bypass-alert-content">
        <div className="bypass-alert-title">{alertInfo.title}</div>
        <div className="bypass-alert-message">{alertInfo.message}</div>
        <div className="bypass-alert-explanation">
          <p>
            <strong>Por que isso é importante?</strong>
          </p>
          <p>
            Todas as transações devem ser feitas dentro da plataforma para garantir segurança,
            rastreabilidade e proteção para ambas as partes. Tentativas de burlar o sistema
            são registradas e podem resultar em bloqueio.
          </p>
        </div>
        {onDismiss && (
          <button className="bypass-alert-dismiss" onClick={onDismiss}>
            Entendi
          </button>
        )}
      </div>
    </div>
  );
}




