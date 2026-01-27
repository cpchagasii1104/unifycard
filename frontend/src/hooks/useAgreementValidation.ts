// frontend/src/hooks/useAgreementValidation.ts
// Hook para validar se pode criar booking/bundle baseado em agreement
// 🔴 BLINDAGEM: Frontend NÃO calcula, apenas valida estado do backend

import { useState, useEffect } from 'react';
import { getFinalizedAgreementByContext, listAgreements, type Agreement } from '../api/agreements';

interface UseAgreementValidationResult {
  agreement: Agreement | null;
  isFinalized: boolean;
  isLoading: boolean;
  error: string | null;
  canProceed: boolean; // Pode criar booking/bundle/service-order
  blockingReason: string | null; // Motivo do bloqueio (se houver)
}

/**
 * Hook para validar se existe acordo FINALIZED para um contexto
 * 🔴 BLINDAGEM: Usado para bloquear UI quando acordo não está finalizado
 */
export function useAgreementValidation(
  contextType: 'event' | 'service' | 'rfq' | 'booking' | 'bundle' | null,
  contextId: string | null,
  requiresAgreement: boolean = true // Se false, não bloqueia mesmo sem acordo
): UseAgreementValidationResult {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contextType || !contextId) {
      setAgreement(null);
      setIsLoading(false);
      return;
    }

    loadAgreement();
  }, [contextType, contextId, requiresAgreement]);

  const loadAgreement = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Primeiro, buscar acordo finalizado
      const finalized = await getFinalizedAgreementByContext(contextType, contextId);
      
      if (finalized) {
        setAgreement(finalized);
      } else if (requiresAgreement) {
        // Se requer acordo mas não há finalizado, buscar qualquer acordo não finalizado
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
      } else {
        setAgreement(null);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao validar acordo');
      console.error('Erro ao validar acordo:', err);
      setAgreement(null);
    } finally {
      setIsLoading(false);
    }
  };

  const isFinalized = agreement?.status === 'FINALIZED' || false;
  
  // Determinar se pode prosseguir
  let canProceed = true;
  let blockingReason: string | null = null;

  if (requiresAgreement && contextType && contextId) {
    if (!agreement) {
      // Não há acordo, mas requer acordo → bloquear
      canProceed = false;
      blockingReason = 'Este serviço exige acordo fechado na plataforma. Crie um acordo antes de continuar.';
    } else if (!isFinalized) {
      // Há acordo mas não está finalizado → bloquear
      canProceed = false;
      const statusText = {
        DRAFT: 'rascunho',
        PROPOSED: 'proposto',
        ACCEPTED: 'aceito',
      }[agreement.status] || agreement.status.toLowerCase();
      blockingReason = `Existe um acordo em negociação (status: ${statusText}). Finalize o acordo antes de criar booking ou bundle.`;
    }
  }

  return {
    agreement,
    isFinalized,
    isLoading,
    error,
    canProceed,
    blockingReason,
  };
}




