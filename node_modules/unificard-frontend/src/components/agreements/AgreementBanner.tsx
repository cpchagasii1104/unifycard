// frontend/src/components/agreements/AgreementBanner.tsx
// Banner para exibir status do acordo em EventPage, RFQ, etc.
// 🔴 BLINDAGEM: Apenas exibe estado, não calcula valores

import { useState, useEffect } from 'react';
import { getFinalizedAgreementByContext, listAgreements, type Agreement } from '../../api/agreements';
import './AgreementBanner.css';

interface AgreementBannerProps {
  contextType: 'event' | 'service' | 'rfq' | 'booking' | 'bundle';
  contextId: string;
  onAgreementClick?: () => void;
}

export default function AgreementBanner({
  contextType,
  contextId,
  onAgreementClick,
}: AgreementBannerProps) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAgreement();
  }, [contextType, contextId]);

  const loadAgreement = async () => {
    setIsLoading(true);
    try {
      // Buscar acordo finalizado primeiro
      const finalized = await getFinalizedAgreementByContext(contextType, contextId);
      if (finalized) {
        setAgreement(finalized);
      } else {
        // Se não houver finalizado, buscar qualquer acordo não finalizado
        const result = await listAgreements({
          contextType,
          contextId,
          limit: 1,
        });
        if (result.agreements.length > 0) {
          const nonFinalized = result.agreements.find((a) => a.status !== 'FINALIZED');
          setAgreement(nonFinalized || result.agreements[0]);
        } else {
          setAgreement(null);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar acordo:', err);
      setAgreement(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!agreement) {
    return null;
  }

  const isFinalized = agreement.status === 'FINALIZED';
  const isInProgress = !isFinalized && (agreement.status === 'DRAFT' || agreement.status === 'PROPOSED' || agreement.status === 'ACCEPTED');

  if (!isFinalized && !isInProgress) {
    return null;
  }

  return (
    <div
      className={`agreement-banner ${isFinalized ? 'agreement-banner-finalized' : 'agreement-banner-in-progress'}`}
      onClick={onAgreementClick}
      style={{ cursor: onAgreementClick ? 'pointer' : 'default' }}
    >
      <div className="agreement-banner-icon">
        {isFinalized ? '✓' : '⚠️'}
      </div>
      <div className="agreement-banner-content">
        <div className="agreement-banner-title">
          {isFinalized ? 'Acordo Fechado' : 'Negociação em Andamento'}
        </div>
        <div className="agreement-banner-message">
          {isFinalized
            ? 'Este acordo foi finalizado e está pronto para uso.'
            : 'Existe um acordo em negociação. Finalize-o antes de criar bookings ou bundles.'}
        </div>
        {agreement.priceCents > 0 && (
          <div className="agreement-banner-price">
            Valor acordado: {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: agreement.currency || 'BRL',
            }).format(agreement.priceCents / 100)}
          </div>
        )}
      </div>
      {onAgreementClick && (
        <div className="agreement-banner-action">
          <button className="btn-link">Ver Acordo →</button>
        </div>
      )}
    </div>
  );
}




