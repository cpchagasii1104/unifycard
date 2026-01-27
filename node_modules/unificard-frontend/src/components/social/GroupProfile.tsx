// src/components/social/GroupProfile.tsx
// Perfil de grupo mostrando total recebido e últimas ações

import { useState, useEffect } from 'react';
import { getLedgerSummary, getLedger } from '../../api/social';
import './GroupProfile.css';

interface GroupProfileProps {
  groupId: string;
  groupName?: string;
}

interface GroupContribution {
  group_id: string;
  group_name: string;
  total_contributed_cents: number;
}

interface LedgerEntry {
  ledger_id: string;
  post_id: string | null;
  cta_id: string | null;
  recipient_group_id: string | null;
  amount_cents: number;
  currency: string;
  amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
  description: string | null;
  created_at: string;
}

export default function GroupProfile({ groupId, groupName }: GroupProfileProps) {
  const [totalReceived, setTotalReceived] = useState<number>(0);
  const [recentActions, setRecentActions] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>(groupName || 'Comunidade');

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      setIsLoading(true);
      
      // Buscar resumo do ledger para encontrar contribuições do grupo
      const summary = await getLedgerSummary();
      const groupContribution = summary.group_contributions?.find(
        (g: GroupContribution) => g.group_id === groupId
      );
      
      if (groupContribution) {
        setTotalReceived(groupContribution.total_contributed_cents);
        if (groupContribution.group_name) {
          setDisplayName(groupContribution.group_name);
        }
      }

      // Buscar últimas ações (ledger entries relacionadas ao grupo)
      const ledgerResponse = await getLedger({ limit: 20 });
      const groupEntries = ledgerResponse.entries
        .filter((entry: LedgerEntry) => entry.recipient_group_id === groupId)
        .slice(0, 5); // Últimas 5 ações
      
      setRecentActions(groupEntries);
    } catch (error) {
      console.warn('Erro ao carregar dados do grupo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="group-profile-loading">
        <p>Carregando informações da comunidade...</p>
      </div>
    );
  }

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="group-profile">
      <div className="group-profile-header">
        <div className="group-avatar">
          <span className="group-avatar-icon">👥</span>
        </div>
        <div className="group-info">
          <h2 className="group-name">{displayName}</h2>
          <p className="group-subtitle">Comunidade ativa</p>
        </div>
      </div>

      <div className="group-stats">
        <div className="group-stat-item">
          <span className="stat-label">Total recebido</span>
          <span className="stat-value">{formatPrice(totalReceived)}</span>
        </div>
        {recentActions.length > 0 && (
          <div className="group-stat-item">
            <span className="stat-label">Últimas ações</span>
            <span className="stat-value">{recentActions.length}</span>
          </div>
        )}
      </div>

      {recentActions.length > 0 && (
        <div className="group-recent-actions">
          <h3 className="recent-actions-title">Últimas ações que geraram impacto</h3>
          <div className="actions-list">
            {recentActions.map((action) => (
              <div key={action.ledger_id} className="action-item">
                <div className="action-info">
                  <span className="action-icon">
                    {action.amount_type === 'profit_share' ? '💚' : '💰'}
                  </span>
                  <div className="action-details">
                    <span className="action-description">
                      {action.description || 'Contribuição para a comunidade'}
                    </span>
                    <time className="action-date">{formatDate(action.created_at)}</time>
                  </div>
                </div>
                <span className="action-amount">{formatPrice(action.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="group-cta-section">
        <button
          className="group-cta-button"
          onClick={() => {
            // Navegar para página do grupo ou abrir modal de participação
            window.location.href = `/groups/${groupId}`;
          }}
        >
          Participar da comunidade
        </button>
        <button
          className="group-cta-button secondary"
          onClick={() => {
            // Mostrar impacto coletivo
            window.location.href = `/groups/${groupId}/impact`;
          }}
        >
          Ver impacto coletivo
        </button>
      </div>
    </div>
  );
}


