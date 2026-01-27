// frontend/src/components/timeline/TimelineInstitucional.tsx
// CONTINUOUS PRODUCTION: Timeline Institucional - SPRINT 3
// Visão clara, cronológica e auditável das ações realizadas em nome de um Actor

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { aggregateActivities, type ActivityItem, type ActivityType } from '../../services/activity-aggregation.service';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { getAuthoritySourceLabel, type AuthoritySource } from '../../types/authority-context';
import ActivityDetailModal from './ActivityDetailModal';
import './TimelineInstitucional.css';

interface TimelineInstitucionalProps {
  actorId?: string; // Actor para filtrar atividades
  companyId?: string; // Empresa para filtrar atividades
  limit?: number; // Limite de atividades
  showContext?: boolean; // Mostrar contexto humano (quem, em nome de quem)
}

export default function TimelineInstitucional({
  actorId,
  companyId,
  limit = 50,
  showContext = true,
}: TimelineInstitucionalProps) {
  const { sessionReady, activeActor } = useSession();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId()) {
      setLoading(false);
      return;
    }

    // Usar actorId fornecido ou activeActor
    const targetActorId = actorId || activeActor?.actor_id;
    if (!targetActorId && !companyId) {
      setLoading(false);
      return;
    }

    loadActivities();
  }, [sessionReady, actorId, companyId, activeActor?.actor_id]);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const targetActorId = actorId || activeActor?.actor_id;
      const items = await aggregateActivities({
        actorId: targetActorId,
        companyId,
        limit,
      });

      setActivities(items);
    } catch (err: any) {
      console.error('Erro ao carregar timeline:', err);
      setError(err.message || 'Erro ao carregar atividades');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Formato relativo para eventos recentes
    if (diffMins < 1) {
      return 'Agora';
    } else if (diffMins < 60) {
      return `Há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `Há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `Há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
    } else {
      // Formato completo para eventos antigos
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
  };

  const getActivityIcon = (type: ActivityType): string => {
    const icons: Record<ActivityType, string> = {
      transaction: '💰',
      transaction_reversed: '↩️',
      member_added: '➕',
      member_removed: '➖',
      member_updated: '✏️',
      delegation_created: '🔗',
      delegation_revoked: '🔓',
      event_created: '📅',
      service_executed: '⚙️',
      post_created: '📝',
      other: '📋',
    };
    return icons[type] || '📋';
  };

  const getActivityColor = (type: ActivityType): string => {
    const colors: Record<ActivityType, string> = {
      transaction: '#28a745',
      transaction_reversed: '#dc3545',
      member_added: '#007bff',
      member_removed: '#dc3545',
      member_updated: '#ffc107',
      delegation_created: '#17a2b8',
      delegation_revoked: '#6c757d',
      event_created: '#6f42c1',
      service_executed: '#fd7e14',
      post_created: '#20c997',
      other: '#6c757d',
    };
    return colors[type] || '#6c757d';
  };

  if (loading) {
    return (
      <div className="timeline-institucional">
        <div className="timeline-loading">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="timeline-skeleton-item">
              <div className="timeline-skeleton-icon" />
              <div className="timeline-skeleton-content">
                <div className="timeline-skeleton-line" />
                <div className="timeline-skeleton-line short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="timeline-institucional">
        <div className="timeline-error">
          <p>Erro ao carregar timeline: {error}</p>
          <button onClick={loadActivities} className="timeline-retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="timeline-institucional">
        <div className="timeline-empty">
          <p>Nenhuma atividade registrada ainda.</p>
          <p className="timeline-empty-hint">
            As atividades aparecerão aqui conforme ações forem realizadas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="timeline-institucional">
        <div className="timeline-list">
          {activities.map((activity, index) => (
            <div key={activity.id} className="timeline-item">
              <div
                className="timeline-icon"
                style={{ backgroundColor: `${getActivityColor(activity.type)}20`, color: getActivityColor(activity.type) }}
              >
                {getActivityIcon(activity.type)}
              </div>
              <div className="timeline-content">
                <div className="timeline-description">{activity.description}</div>
                {showContext && (activity.actingUserId || activity.actorId) && (
                  <div className="timeline-context">
                    {activity.actingUserId && (
                      <span className="timeline-context-item" title={`User ID: ${activity.actingUserId}`}>
                        Executado por: {activity.actingUserId.substring(0, 8)}...
                      </span>
                    )}
                    {activity.actorId && activity.actorId !== 'unknown' && (
                      <span className="timeline-context-item" title={`Actor ID: ${activity.actorId}`}>
                        Em nome de: {activity.actorId.substring(0, 8)}...
                      </span>
                    )}
                    {activity.metadata?.authority_source && (
                      <span 
                        className="timeline-context-item timeline-authority" 
                        title={`Fonte de autoridade: ${getAuthoritySourceLabel(activity.metadata.authority_source as AuthoritySource)}`}
                      >
                        Autoridade: {getAuthoritySourceLabel(activity.metadata.authority_source as AuthoritySource)}
                      </span>
                    )}
                  </div>
                )}
                <div className="timeline-footer">
                  <div className="timeline-date">{formatDate(activity.createdAt)}</div>
                  {(activity.type === 'transaction' || 
                    activity.type === 'member_added' || 
                    activity.type === 'member_removed' ||
                    activity.type === 'member_updated') && (
                    <button
                      onClick={() => setSelectedActivity(activity)}
                      className="timeline-detail-button"
                      type="button"
                      title="Ver detalhes de responsabilidade"
                    >
                      Ver detalhes
                    </button>
                  )}
                </div>
              </div>
              {index < activities.length - 1 && <div className="timeline-connector" />}
            </div>
          ))}
        </div>
      </div>

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </>
  );
}







