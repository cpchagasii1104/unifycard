// frontend/src/components/health/HealthSummaryCard.tsx
// CONTINUOUS PRODUCTION: Card de Resumo de Saúde - SPRINT 9
// Exibe sinais simples de saúde baseados em dados reais

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { getUserHealthSignals } from '../../services/health-signals.service';
import type { HealthSignal } from '../../types/health-signal';
import { isAuthenticated, getTenantId } from '../../config/auth';
import HealthSignalItem from './HealthSignalItem';
import './HealthSummaryCard.css';

interface HealthSummaryCardProps {
  maxSignals?: number; // Limitar número de sinais exibidos
  showEmptyState?: boolean; // Mostrar mensagem quando não há sinais
}

export default function HealthSummaryCard({
  maxSignals = 3,
  showEmptyState = false,
}: HealthSummaryCardProps) {
  const { sessionReady, activeActor } = useSession();
  const [signals, setSignals] = useState<HealthSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadHealthSignals();
  }, [sessionReady, activeActor?.actor_id]);

  const loadHealthSignals = async () => {
    setLoading(true);
    setError(null);

    try {
      const detected = await getUserHealthSignals({
        actorId: activeActor!.actor_id,
        actorType: activeActor!.actor_type as 'user' | 'page' | 'group' | 'project',
        userId: activeActor!.actor_type === 'user' ? activeActor!.actor_id : undefined,
        companyId: activeActor!.actor_type === 'page' ? activeActor!.actor_id : undefined,
      });
      
      setSignals(detected.slice(0, maxSignals));
    } catch (err: any) {
      console.warn('Erro ao carregar sinais de saúde:', err);
      setError(err.message || 'Erro ao carregar sinais');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="health-summary-card">
        <div className="health-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Não mostrar erro, apenas não exibir card
  }

  if (signals.length === 0) {
    if (!showEmptyState) {
      return null;
    }
    return (
      <div className="health-summary-card">
        <div className="health-empty">
          <p>Nenhum sinal de saúde disponível no momento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="health-summary-card">
      <div className="health-header">
        <h3>Observações</h3>
        <span className="health-subtitle">Baseado em atividade recente</span>
      </div>

      <div className="health-signals-list">
        {signals.map((signal) => (
          <HealthSignalItem key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}







