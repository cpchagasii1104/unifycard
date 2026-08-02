// frontend/src/components/trust/TrustAlert.tsx
// Alerta de Trust Score (HIGH ou BLOCKED)
// 🔴 BLINDAGEM: Apenas exibe estado, não toma decisões

import { useState, useEffect } from 'react';
import { getTrustProfile, canProceedWithAction, type TrustProfile, type RiskLevel } from '../../api/trust';
import './TrustAlert.css';

interface TrustAlertProps {
  actorId: string;
  action: string;
  contextType?: string;
  contextId?: string;
  onBlocked?: () => void;
}

export default function TrustAlert({
  actorId,
  action,
  contextType,
  contextId,
  onBlocked,
}: TrustAlertProps) {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [canProceed, setCanProceed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrustData();
  }, [actorId, action]);

  const loadTrustData = async () => {
    setIsLoading(true);
    try {
      const [profileData, proceedData] = await Promise.all([
        getTrustProfile(actorId),
        canProceedWithAction({
          action,
          actorId,
          contextType,
          contextId,
        }),
      ]);
      setProfile(profileData);
      setCanProceed(proceedData.canProceed);

      if (!proceedData.canProceed && onBlocked) {
        onBlocked();
      }
    } catch (err) {
      console.error('Erro ao carregar trust data:', err);
      setProfile(null);
      setCanProceed(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profile) {
    return null;
  }

  // Mostrar alerta apenas para HIGH ou BLOCKED
  if (profile.riskLevel !== 'high' && profile.riskLevel !== 'critical') {
    return null;
  }

  const getAlertInfo = (riskLevel: RiskLevel, canProceed: boolean | null) => {
    if (riskLevel === 'critical') {
      return {
        title: '⚠️ Actor Bloqueado',
        message: 'Este actor foi bloqueado devido a baixo trust score. Entre em contato com o suporte.',
        type: 'blocked',
      };
    }

    if (riskLevel === 'high' && canProceed === false) {
      return {
        title: '⚠️ Ação Bloqueada',
        message: 'Esta ação foi bloqueada devido a baixo trust score. Entre em contato com o suporte.',
        type: 'blocked',
      };
    }

    if (riskLevel === 'high') {
      return {
        title: '⚠️ Trust Score Baixo',
        message: 'Este actor possui trust score baixo. Proceda com cautela.',
        type: 'warning',
      };
    }

    return null;
  };

  const alertInfo = getAlertInfo(profile.riskLevel, canProceed);
  if (!alertInfo) return null;

  return (
    <div className={`trust-alert trust-alert-${alertInfo.type}`}>
      <div className="trust-alert-icon">
        {alertInfo.type === 'blocked' ? '🚫' : '⚠️'}
      </div>
      <div className="trust-alert-content">
        <div className="trust-alert-title">{alertInfo.title}</div>
        <div className="trust-alert-message">{alertInfo.message}</div>
        <div className="trust-alert-score">
          Score atual: {profile.currentScore}/100
        </div>
      </div>
    </div>
  );
}




