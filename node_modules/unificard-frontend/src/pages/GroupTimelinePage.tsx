// src/pages/GroupTimelinePage.tsx
// Timeline do Grupo
// SPRINT: Groups MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupTimeline, type TimelineItem, type TimelineItemType } from '../api/group-timeline';
import { getGroup } from '../api/groups';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import './GroupTimelinePage.css';

export default function GroupTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [groupName, setGroupName] = useState<string>('');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TimelineItemType | 'ALL'>('ALL');

  useEffect(() => {
    if (id) {
      loadGroup();
      loadTimeline();
    }
  }, [id, typeFilter]);

  const loadGroup = async () => {
    if (!id) return;
    try {
      const group = await getGroup(id);
      setGroupName(group.name);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
    }
  };

  const loadTimeline = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const actorType = activeActor?.actor_type === 'page' ? 'page' : 'user';
      const actorId = activeActor?.actor_id || '';
      const data = await getGroupTimeline(id, 100, actorType, actorId);
      
      // Aplicar filtro
      const filtered = typeFilter === 'ALL' 
        ? data 
        : data.filter(item => item.type === typeFilter);
      
      setTimeline(filtered);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar timeline');
      showToast(err.message || 'Erro ao carregar timeline', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeLabel = (type: TimelineItemType): string => {
    const labels: Record<TimelineItemType, string> = {
      event: 'Evento',
      campaign: 'Campanha',
      vote: 'Votação',
      post: 'Post',
      finance: 'Financeiro',
      milestone: 'Marco',
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type: TimelineItemType): string => {
    const icons: Record<TimelineItemType, string> = {
      event: '📅',
      campaign: '🎯',
      vote: '🗳️',
      post: '💬',
      finance: '💰',
      milestone: '🏆',
    };
    return icons[type] || '•';
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleItemClick = (item: TimelineItem) => {
    if (item.type === 'vote') {
      navigate(`/grupos/${id}/votes/${item.id}`);
    } else if (item.type === 'campaign') {
      navigate(`/grupos/${id}/campaigns/${item.id}`);
    }
    // Posts e eventos podem não ter página de detalhe dedicada
  };

  if (isLoading) {
    return (
      <div className="group-timeline-page">
        <div className="loading">Carregando timeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-timeline-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadTimeline}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-timeline-page">
      <div className="page-header">
        <button onClick={() => navigate(`/grupos/${id}`)}>← Voltar</button>
        <h1>Timeline: {groupName}</h1>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="type-filter">Tipo:</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TimelineItemType | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="post">Posts</option>
            <option value="vote">Votações</option>
            <option value="event">Eventos</option>
            <option value="campaign">Campanhas</option>
            <option value="finance">Financeiro</option>
            <option value="milestone">Marcos</option>
          </select>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma atividade encontrada na timeline.</p>
        </div>
      ) : (
        <div className="timeline-container">
          {timeline.map((item) => (
            <div
              key={item.id}
              className={`timeline-item timeline-item-${item.type}`}
              onClick={() => handleItemClick(item)}
            >
              <div className="timeline-item-header">
                <span className="timeline-item-icon">{getTypeIcon(item.type)}</span>
                <span className="timeline-item-type">{getTypeLabel(item.type)}</span>
                <span className="timeline-item-date">{formatDateTime(item.date)}</span>
              </div>
              <div className="timeline-item-content">
                <h3 className="timeline-item-title">{item.title}</h3>
                {item.description && (
                  <p className="timeline-item-description">{item.description}</p>
                )}
                {item.actorName && (
                  <div className="timeline-item-actor">
                    Por: {item.actorName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

