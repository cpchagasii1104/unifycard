// frontend/src/components/company/AccountabilitySection.tsx
// CONTINUOUS PRODUCTION: Seção de Responsabilidade & Autoridade - SPRINT 10
// Exibe últimas ações com informações de responsabilidade

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { aggregateActivities, type ActivityItem } from '../../services/activity-aggregation.service';
import { getAuthoritySourceLabel, type AuthoritySource } from '../../types/authority-context';
import { isAuthenticated, getTenantId } from '../../config/auth';
import ActivityDetailModal from '../timeline/ActivityDetailModal';
import './AccountabilitySection.css';

interface AccountabilitySectionProps {
  companyId: string;
  maxItems?: number;
}

export default function AccountabilitySection({ companyId, maxItems = 5 }: AccountabilitySectionProps) {
  const { sessionReady, activeActor } = useSession();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadAccountabilityData();
  }, [sessionReady, activeActor?.actor_id, companyId]);

  const loadAccountabilityData = async () => {
    setLoading(true);
    setError(null);

    try {
      const items = await aggregateActivities({
        companyId,
        limit: maxItems,
      });

      setActivities(items);
    } catch (err: any) {
      console.warn('Erro ao carregar responsabilidades:', err);
      setError(err.message || 'Erro ao carregar responsabilidades');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="accountability-section">
        <div className="accountability-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Não mostrar erro, apenas não exibir seção
  }

  if (activities.length === 0) {
    return (
      <div className="accountability-section">
        <div className="accountability-empty">
          <p>Nenhuma ação registrada ainda</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="accountability-section">
        <div className="accountability-header">
          <h3>Responsabilidade & Autoridade</h3>
          <p className="accountability-subtitle">
            Últimas ações realizadas em nome desta empresa
          </p>
        </div>

        <div className="accountability-list">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="accountability-item"
              onClick={() => setSelectedActivity(activity)}
              style={{ cursor: 'pointer' }}
            >
              <div className="accountability-description">{activity.description}</div>
              <div className="accountability-meta">
                {activity.actingUserId && (
                  <span className="accountability-meta-item" title={activity.actingUserId}>
                    Responsável: {activity.actingUserId.substring(0, 8)}...
                  </span>
                )}
                {activity.metadata?.authority_source && (
                  <span className="accountability-meta-item accountability-authority">
                    {getAuthoritySourceLabel(activity.metadata.authority_source as AuthoritySource)}
                  </span>
                )}
                <span className="accountability-meta-item accountability-date">
                  {formatDate(activity.createdAt)}
                </span>
              </div>
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







