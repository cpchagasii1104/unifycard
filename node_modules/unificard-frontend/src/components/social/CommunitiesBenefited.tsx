// src/components/social/CommunitiesBenefited.tsx
// Bloco "Comunidades beneficiadas" para posts com impacto

import { useState, useEffect } from 'react';
import { getLedgerSummary } from '../../api/social';
import { OnboardingHighlight, useOnboardingHighlights } from '../onboarding/OnboardingHighlights';
import './CommunitiesBenefited.css';

interface CommunitiesBenefitedProps {
  postId?: string;
  ctaId?: string | null;
}

interface GroupContribution {
  group_id: string;
  group_name: string;
  total_contributed_cents: number;
}

export default function CommunitiesBenefited({ postId, ctaId }: CommunitiesBenefitedProps) {
  const [groupContributions, setGroupContributions] = useState<GroupContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const showHighlights = useOnboardingHighlights();

  useEffect(() => {
    loadGroupContributions();
  }, [postId, ctaId]);

  const loadGroupContributions = async () => {
    try {
      setIsLoading(true);
      const summary = await getLedgerSummary();
      
      // Se houver postId ou ctaId, filtrar apenas contribuições relacionadas
      // Por enquanto, mostrar todas as contribuições do usuário
      if (summary.group_contributions && summary.group_contributions.length > 0) {
        setGroupContributions(summary.group_contributions);
      } else {
        setGroupContributions([]);
      }
    } catch (error) {
      console.warn('Erro ao buscar contribuições para grupos:', error);
      setGroupContributions([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  if (groupContributions.length === 0) {
    return null;
  }

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const totalContributed = groupContributions.reduce(
    (sum, g) => sum + g.total_contributed_cents,
    0
  );

  return (
    <div className="communities-benefited" id="communities-benefited">
      <div className="communities-header">
        <span className="communities-icon">👥</span>
        <h3 className="communities-title">Comunidades beneficiadas</h3>
      </div>
      
      {showHighlights && groupContributions.length > 0 && (
        <OnboardingHighlight
          targetId="communities-benefited"
          message="Veja como seu impacto fortalece comunidades locais"
          position="top"
          delay={2000}
        />
      )}

      <div className="communities-list">
        {groupContributions.map((group) => (
          <div key={group.group_id} className="community-item">
            <div className="community-info">
              <span className="community-name">{group.group_name}</span>
              <span className="community-amount">
                {formatPrice(group.total_contributed_cents)}
              </span>
            </div>
            <button
              className="community-cta"
              onClick={() => {
                // Navegar para perfil do grupo
                window.location.href = `/groups/${group.group_id}`;
              }}
            >
              Ver comunidade
            </button>
          </div>
        ))}
      </div>

      <div className="communities-total">
        <span className="total-label">Total contribuído</span>
        <span className="total-value">{formatPrice(totalContributed)}</span>
      </div>

      <div className="communities-message">
        <span className="message-icon">💚</span>
        <span className="message-text">
          Seu impacto está fortalecendo essas comunidades!
        </span>
      </div>
    </div>
  );
}

