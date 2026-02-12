// frontend/src/components/evidence/DisputeBanner.tsx
// Banner de status de disputa
// 🔴 BLINDAGEM: Apenas exibe estado, não toma decisões

import { useState, useEffect } from 'react';
import { getEvidencePackByContext, type EvidencePack, type DisputeStatus } from '../../api/evidence';
import './DisputeBanner.css';

interface DisputeBannerProps {
  contextType: 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement';
  contextId: string;
  onViewEvidence?: () => void;
}

export default function DisputeBanner({
  contextType,
  contextId,
  onViewEvidence,
}: DisputeBannerProps) {
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvidencePack();
  }, [contextType, contextId]);

  const loadEvidencePack = async () => {
    setIsLoading(true);
    try {
      const data = await getEvidencePackByContext(contextType, contextId);
      setPack(data);
    } catch (err) {
      console.error('Erro ao carregar evidence pack:', err);
      setPack(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !pack || pack.disputeStatus === 'NONE') {
    return null;
  }

  const getStatusInfo = (status: DisputeStatus) => {
    switch (status) {
      case 'OPEN':
        return {
          icon: '⚠️',
          title: 'Disputa Aberta',
          message: 'Existe uma disputa aberta relacionada a este contexto.',
          className: 'dispute-banner-open',
        };
      case 'IN_MEDIATION':
        return {
          icon: '⚖️',
          title: 'Disputa em Mediação',
          message: 'Esta disputa está em processo de mediação.',
          className: 'dispute-banner-mediation',
        };
      case 'RESOLVED':
        return {
          icon: '✅',
          title: 'Disputa Resolvida',
          message: 'Esta disputa foi resolvida.',
          className: 'dispute-banner-resolved',
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo(pack.disputeStatus);
  if (!statusInfo) return null;

  return (
    <div className={`dispute-banner ${statusInfo.className}`}>
      <div className="dispute-banner-icon">{statusInfo.icon}</div>
      <div className="dispute-banner-content">
        <div className="dispute-banner-title">{statusInfo.title}</div>
        <div className="dispute-banner-message">{statusInfo.message}</div>
        {pack.openedAt && (
          <div className="dispute-banner-date">
            Aberta em: {new Date(pack.openedAt).toLocaleString('pt-BR')}
          </div>
        )}
        {pack.resolvedAt && (
          <div className="dispute-banner-date">
            Resolvida em: {new Date(pack.resolvedAt).toLocaleString('pt-BR')}
          </div>
        )}
      </div>
      {onViewEvidence && (
        <div className="dispute-banner-action">
          <button className="btn-link" onClick={onViewEvidence}>
            Ver Evidências →
          </button>
        </div>
      )}
    </div>
  );
}




