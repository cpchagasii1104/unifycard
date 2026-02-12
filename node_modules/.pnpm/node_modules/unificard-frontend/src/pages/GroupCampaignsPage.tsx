// src/pages/GroupCampaignsPage.tsx
// Lista de Campanhas do Grupo
// SPRINT: Groups MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listGroupCampaigns, type GroupCampaign } from '../api/group-campaigns';
import { getGroup } from '../api/groups';
import { showToast } from '../components/common/Toast';
import './GroupCampaignsPage.css';

export default function GroupCampaignsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState<string>('');
  const [campaigns, setCampaigns] = useState<GroupCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadGroup();
      loadCampaigns();
    }
  }, [id]);

  const loadGroup = async () => {
    if (!id) return;
    try {
      const group = await getGroup(id);
      setGroupName(group.name);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
    }
  };

  const loadCampaigns = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await listGroupCampaigns(id);
      setCampaigns(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar campanhas');
      showToast(err.message || 'Erro ao carregar campanhas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      active: 'Ativa',
      paused: 'Pausada',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      donation: 'Doação',
      action: 'Ação',
      fundraising: 'Arrecadação',
      awareness: 'Conscientização',
    };
    return labels[type] || type;
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="group-campaigns-page">
        <div className="loading">Carregando campanhas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-campaigns-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadCampaigns}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-campaigns-page">
      <div className="page-header">
        <button onClick={() => navigate(`/grupos/${id}`)}>← Voltar</button>
        <h1>Campanhas: {groupName}</h1>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma campanha encontrada.</p>
          <p className="empty-hint">
            As campanhas do grupo aparecerão aqui quando forem criadas.
          </p>
        </div>
      ) : (
        <div className="campaigns-list">
          {campaigns.map((campaign) => (
            <div
              key={campaign.campaignId}
              className="campaign-item"
              onClick={() => navigate(`/grupos/${id}/campaigns/${campaign.campaignId}`)}
            >
              <div className="campaign-header">
                <h3 className="campaign-title">{campaign.title}</h3>
                <span className={`campaign-status status-${campaign.status}`}>
                  {getStatusLabel(campaign.status)}
                </span>
              </div>
              <p className="campaign-description">{campaign.description}</p>
              <div className="campaign-meta">
                <span className="campaign-type">{getTypeLabel(campaign.type)}</span>
                {campaign.goalValue && (
                  <span className="campaign-progress">
                    {formatCurrency(campaign.currentValue)} / {formatCurrency(campaign.goalValue)}
                  </span>
                )}
              </div>
              <div className="campaign-dates">
                <span>Início: {formatDateTime(campaign.startsAt)}</span>
                {campaign.endsAt && (
                  <span>Fim: {formatDateTime(campaign.endsAt)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




