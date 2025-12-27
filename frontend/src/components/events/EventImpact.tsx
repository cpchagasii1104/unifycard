// src/components/events/EventImpact.tsx
// Mostra impacto gerado por eventos (quando houver dados reais do ledger)

import { useState, useEffect } from 'react';
import { getLedgerSummary } from '../../api/social';
import { safeApiCall, safeNumber } from '../../utils/guardrails';
import { devLog } from '../../utils/devLog';
import './EventImpact.css';

interface EventImpactProps {
  eventId: string;
}

export default function EventImpact({ eventId }: EventImpactProps) {
  const [hasImpact, setHasImpact] = useState(false);
  const [totalContributed, setTotalContributed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadImpact();
  }, [eventId]);

  const loadImpact = async () => {
    try {
      setIsLoading(true);
      
      // Buscar resumo do ledger (dados reais)
      const summary = await safeApiCall(
        async () => getLedgerSummary(),
        {
          total_revenue_cents: 0,
          total_profit_share_received_cents: 0,
          total_donations_given_cents: 0,
          total_commissions_cents: 0,
          group_contributions: [],
        },
        'Erro ao carregar impacto do evento'
      );

      // Verificar se há contribuições para grupos (impacto real)
      const total = safeNumber(summary.total_profit_share_received_cents, 0);
      const hasContributions = summary.group_contributions && summary.group_contributions.length > 0;

      setTotalContributed(total);
      setHasImpact(hasContributions && total > 0);
    } catch (err) {
      devLog.error('Erro ao carregar impacto do evento:', err);
      setHasImpact(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Não mostrar nada enquanto carrega
  }

  if (!hasImpact) {
    return null; // Não mostrar se não houver impacto
  }

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <div className="event-impact">
      <div className="event-impact-header">
        <span className="event-impact-icon">💚</span>
        <h3 className="event-impact-title">Impacto Gerado</h3>
      </div>
      
      <div className="event-impact-message">
        <p className="event-impact-text">
          Este evento já gerou impacto para a comunidade através de compras e participações.
        </p>
        {totalContributed > 0 && (
          <div className="event-impact-total">
            <span className="event-impact-total-label">Total contribuído para comunidades:</span>
            <span className="event-impact-total-value">{formatPrice(totalContributed)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

