// src/pages/GroupCampaignDetailPage.tsx
// Detalhe de Campanha do Grupo
// SPRINT: Groups MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupCampaign, type GroupCampaign } from '../api/group-campaigns';
import { getGroup } from '../api/groups';
import { showToast } from '../components/common/Toast';
import './GroupCampaignDetailPage.css';

export default function GroupCampaignDetailPage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState<string>('');
  const [campaign, setCampaign] = useState<GroupCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && campaignId) {
      loadGroup();
      loadCampaign();
    }
  }, [id, campaignId]);

  const loadGroup = async () => {
    if (!id) return;
    try {
      const group = await getGroup(id);
      setGroupName(group.name);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
    }
  };

  const loadCampaign = async () => {
    if (!id || !campaignId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getGroupCampaign(id, campaignId);
      if (!data) {
        setError('Campanha não encontrada');
      } else {
        setCampaign(data);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar campanha');
      showToast(err.message || 'Erro ao carregar campanha', 'error');
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

  const calculateProgress = (): number => {
    if (!campaign || !campaign.goalValue) return 0;
    return Math.min(Math.round((campaign.currentValue / campaign.goalValue) * 100), 100);
  };

  if (isLoading) {
    return (
      <div className="group-campaign-detail-page">
        <div className="loading">Carregando campanha...</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="group-campaign-detail-page">
        <div className="error">
          <p>{error || 'Campanha não encontrada'}</p>
          <button onClick={() => navigate(`/grupos/${id}/campaigns`)}>Voltar para Lista</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-campaign-detail-page">
      <div className="page-header">
        <button onClick={() => navigate(`/grupos/${id}/campaigns`)}>← Voltar</button>
        <h1>{campaign.title}</h1>
        <span className={`campaign-status status-${campaign.status}`}>
          {getStatusLabel(campaign.status)}
        </span>
      </div>

      <div className="campaign-content">
        <div className="campaign-main">
          <div className="campaign-section">
            <h2>Descrição</h2>
            <p className="campaign-description">{campaign.description}</p>
          </div>

          {campaign.goalValue && (
            <div className="campaign-section">
              <h2>Progresso</h2>
              <div className="campaign-progress-container">
                <div className="campaign-progress-bar">
                  <div
                    className="campaign-progress-fill"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
                <div className="campaign-progress-text">
                  <span>{formatCurrency(campaign.currentValue)}</span>
                  <span>de {formatCurrency(campaign.goalValue)}</span>
                  <span>{calculateProgress()}%</span>
                </div>
              </div>
            </div>
          )}

          <div className="campaign-section">
            <h2>Informações</h2>
            <div className="campaign-info">
              <div className="info-item">
                <label>Tipo:</label>
                <span>{getTypeLabel(campaign.type)}</span>
              </div>
              <div className="info-item">
                <label>Status:</label>
                <span>{getStatusLabel(campaign.status)}</span>
              </div>
              <div className="info-item">
                <label>Início:</label>
                <span>{formatDateTime(campaign.startsAt)}</span>
              </div>
              {campaign.endsAt && (
                <div className="info-item">
                  <label>Fim:</label>
                  <span>{formatDateTime(campaign.endsAt)}</span>
                </div>
              )}
              <div className="info-item">
                <label>Criada em:</label>
                <span>{formatDateTime(campaign.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




