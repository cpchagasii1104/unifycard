// frontend/src/components/trust/TrustBadge.tsx
// Badge de Trust Score
// 🔴 BLINDAGEM: Apenas exibe score, não calcula

import { useState, useEffect } from 'react';
import { getTrustProfile, type TrustProfile, type RiskLevel } from '../../api/trust';
import './TrustBadge.css';

interface TrustBadgeProps {
  actorId: string;
  showTooltip?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function TrustBadge({
  actorId,
  showTooltip = true,
  size = 'medium',
}: TrustBadgeProps) {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTooltipState, setShowTooltipState] = useState(false);

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

  const getRiskLevelInfo = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case 'low':
        return {
          label: 'Alta Confiança',
          color: 'trust-low',
          icon: '✓',
        };
      case 'medium':
        return {
          label: 'Confiança Média',
          color: 'trust-medium',
          icon: '⚠',
        };
      case 'high':
        return {
          label: 'Baixa Confiança',
          color: 'trust-high',
          icon: '⚠',
        };
      case 'critical':
        return {
          label: 'Bloqueado',
          color: 'trust-blocked',
          icon: '🚫',
        };
      default:
        return {
          label: 'Desconhecido',
          color: 'trust-medium',
          icon: '?',
        };
    }
  };

  const riskInfo = getRiskLevelInfo(profile.riskLevel);

  return (
    <div
      className={`trust-badge trust-badge-${size} trust-badge-${riskInfo.color}`}
      onMouseEnter={() => showTooltip && setShowTooltipState(true)}
      onMouseLeave={() => setShowTooltipState(false)}
    >
      <span className="trust-badge-icon">{riskInfo.icon}</span>
      <span className="trust-badge-score">{profile.currentScore}</span>
      {showTooltip && showTooltipState && (
        <div className="trust-badge-tooltip">
          <div className="tooltip-arrow" />
          <div className="tooltip-content">
            <strong>{riskInfo.label}</strong>
            <p>Score: {profile.currentScore}/100</p>
            <p className="tooltip-explanation">
              Este score reflete histórico de acordos, execuções e disputas.
            </p>
            <p className="tooltip-events">
              {profile.positiveEvents} eventos positivos • {profile.negativeEvents} eventos negativos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}




