// src/components/social/PersonalProgressCard.tsx
// Card de progresso pessoal do usuário no feed

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getActor, getLedgerSummary, getLedger, type ActorResponse } from '../../api/social';
import { getImpactBalance } from '../../api/impact';
import { hasCompletedFirstAction } from './FirstActionHint';
import { validateActiveActor, safeLedgerEntries, safeNumber, safeApiCall } from '../../utils/guardrails';
import './PersonalProgressCard.css';

interface PersonalProgressCardProps {
  postsCount?: number; // Passado do feed se disponível
}

interface ProgressStats {
  postsCreated: number;
  actionsCompleted: number; // CTAs confirmados (estimado via ledger)
  impactGenerated: number;
  communitiesSupported: number; // Grupos distintos que receberam profit_share
}

type NextStep = 
  | { type: 'create_post'; label: 'Criar sua primeira publicação'; action: () => void }
  | { type: 'support_service'; label: 'Apoiar um serviço ou evento'; action: () => void }
  | { type: 'discover_communities'; label: 'Descobrir novas comunidades'; action: () => void };

export default function PersonalProgressCard({ postsCount }: PersonalProgressCardProps) {
  const { activeActor } = useActiveActor();
  const [stats, setStats] = useState<ProgressStats>({
    postsCreated: 0,
    actionsCompleted: 0,
    impactGenerated: 0,
    communitiesSupported: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [weeklyInactivity, setWeeklyInactivity] = useState<WeeklyInactivityState>({
    message: null,
    lastActionDate: null,
  });

  useEffect(() => {
    if (activeActor) {
      loadProgressData();
    }
  }, [activeActor?.actor_id]);

  // Atualizar progresso após ações
  useEffect(() => {
    const handlePostCreated = () => {
      loadProgressData();
    };

    const handleCTAConfirmed = () => {
      loadProgressData();
    };

    const handleImpactChanged = () => {
      loadProgressData();
    };

    window.addEventListener('post-created', handlePostCreated);
    window.addEventListener('cta-confirmed', handleCTAConfirmed);
    window.addEventListener('impact-changed', handleImpactChanged);

    return () => {
      window.removeEventListener('post-created', handlePostCreated);
      window.removeEventListener('cta-confirmed', handleCTAConfirmed);
      window.removeEventListener('impact-changed', handleImpactChanged);
    };
  }, [activeActor?.actor_id]);

  const loadProgressData = async () => {
    if (!activeActor) return;

    try {
      setIsLoading(true);

      // 1. Buscar dados do actor (posts criados)
      let postsCreated = postsCount || 0;
      try {
        const actorData: ActorResponse = await getActor(activeActor.actor_id);
        postsCreated = actorData.counts?.posts_count || 0;
      } catch (err) {
        console.warn('Erro ao carregar dados do actor:', err);
      }

      // 2. Buscar saldo de impacto
      let impactGenerated = 0;
      try {
        const impactBalance = await getImpactBalance(
          activeActor.actor_id,
          activeActor.actor_type as 'user' | 'page'
        );
        impactGenerated = impactBalance.balance || 0;
      } catch (err) {
        console.warn('Erro ao carregar saldo de impacto:', err);
      }

      // 3. Buscar ledger summary e entries (ações e comunidades)
      let actionsCompleted = 0;
      let communitiesSupported = 0;
      let lastActionDate: Date | null = null;
      try {
        const ledgerSummary = await getLedgerSummary();
        
        // Contar ações completadas: entries com profit_share ou revenue (CTAs confirmados)
        // Usar getLedger para contar entries reais
        const ledgerResponse = await getLedger({ limit: 100 });
        const ctaEntries = ledgerResponse.entries.filter(
          (entry: any) => 
            (entry.amount_type === 'profit_share' || entry.amount_type === 'revenue') &&
            entry.cta_id !== null
        );
        actionsCompleted = ctaEntries.length;
        
        // Encontrar última ação (entry mais recente)
        if (ctaEntries.length > 0) {
          const sortedEntries = ctaEntries.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          lastActionDate = new Date(sortedEntries[0].created_at);
        }
        
        // Contar comunidades distintas (grupos que receberam profit_share)
        communitiesSupported = ledgerSummary.group_contributions?.length || 0;
      } catch (err) {
        console.warn('Erro ao carregar ledger summary:', err);
      }

      setStats({
        postsCreated,
        actionsCompleted,
        impactGenerated,
        communitiesSupported,
      });

      // Determinar próximo passo
      const step = determineNextStep({
        postsCreated,
        actionsCompleted,
        impactGenerated,
        communitiesSupported,
      });
      setNextStep(step);

      // Detectar inatividade semanal (leve)
      const weeklyInactivityMessage = getWeeklyInactivityMessage(lastActionDate);
      setWeeklyInactivity({
        message: weeklyInactivityMessage,
        lastActionDate,
      });

      // Colapsar se todos os critérios mínimos forem atendidos
      const allMinimumsMet = postsCreated > 0 && actionsCompleted > 0 && impactGenerated > 0;
      setIsCollapsed(allMinimumsMet);
    } catch (err) {
      console.error('Erro ao carregar progresso:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyInactivityMessage = (lastActionDate: Date | null): string | null => {
    if (!lastActionDate) return null;
    
    const now = Date.now();
    const daysSinceLastAction = (now - lastActionDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastAction >= 7) {
      return 'Que tal apoiar algo esta semana?';
    }
    
    return null;
  };

  const determineNextStep = (currentStats: ProgressStats): NextStep => {
    // Se nunca postou, sugerir criar publicação
    if (currentStats.postsCreated === 0) {
      return {
        type: 'create_post',
        label: 'Criar sua primeira publicação',
        action: () => {
          const composerContainer = document.getElementById('intent-composer');
          if (composerContainer) {
            composerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              const textarea = composerContainer.querySelector('textarea') as HTMLTextAreaElement;
              const input = composerContainer.querySelector('input[type="text"]') as HTMLInputElement;
              const target = textarea || input;
              if (target) {
                target.focus();
              }
            }, 300);
          }
        },
      };
    }

    // Se nunca contratou/comprou, sugerir apoiar serviço/evento
    if (currentStats.actionsCompleted === 0) {
      return {
        type: 'support_service',
        label: 'Apoiar um serviço ou evento',
        action: () => {
          const featuredSection = document.getElementById('featured-today-section');
          if (featuredSection) {
            featuredSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            const firstServicePost = document.querySelector('.post-card--service, .post-card--event');
            if (firstServicePost) {
              firstServicePost.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        },
      };
    }

    // Se já fez ambos, sugerir descobrir comunidades
    return {
      type: 'discover_communities',
      label: 'Descobrir novas comunidades',
      action: () => {
        window.location.href = '/grupos';
      },
    };
  };

  if (isLoading || !activeActor) {
    return null;
  }

  // Não mostrar se FirstActionHint ainda está visível
  if (!hasCompletedFirstAction()) {
    return null;
  }

  return (
    <div className={`personal-progress-card ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="progress-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="progress-title-section">
          <span className="progress-icon">📈</span>
          <div className="progress-title-content">
            <h3 className="progress-title">Seu progresso</h3>
            {isCollapsed && (
              <span className="progress-summary">
                {stats.postsCreated} publicações • {stats.impactGenerated} impacto
              </span>
            )}
          </div>
        </div>
        <button className="progress-toggle" aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="progress-content">
          <div className="progress-stats">
            <div className="progress-stat-item">
              <span className="stat-icon">✍️</span>
              <div className="stat-info">
                <span className="stat-label">Publicações criadas</span>
                <span className="stat-value">{stats.postsCreated}</span>
              </div>
            </div>

            <div className="progress-stat-item">
              <span className="stat-icon">💚</span>
              <div className="stat-info">
                <span className="stat-label">Ações realizadas</span>
                <span className="stat-value">{stats.actionsCompleted}</span>
              </div>
            </div>

            <div className="progress-stat-item">
              <span className="stat-icon">✨</span>
              <div className="stat-info">
                <span className="stat-label">Impacto gerado</span>
                <span className="stat-value">{stats.impactGenerated}</span>
              </div>
            </div>

            <div className="progress-stat-item">
              <span className="stat-icon">👥</span>
              <div className="stat-info">
                <span className="stat-label">Comunidades apoiadas</span>
                <span className="stat-value">{stats.communitiesSupported}</span>
              </div>
            </div>
          </div>

          {nextStep && (
            <div className="progress-next-step">
              {weeklyInactivity.message && (
                <p className="weekly-inactivity-message">{weeklyInactivity.message}</p>
              )}
              <p className="next-step-label">Próximo passo:</p>
              <button
                className="next-step-button"
                onClick={nextStep.action}
              >
                {nextStep.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

