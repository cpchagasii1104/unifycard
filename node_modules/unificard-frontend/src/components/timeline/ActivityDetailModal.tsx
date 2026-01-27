// frontend/src/components/timeline/ActivityDetailModal.tsx
// CONTINUOUS PRODUCTION: Modal de Detalhes de Atividade - SPRINT 10
// Exibe informações completas de responsabilidade e autoridade

import { useState } from 'react';
import { ActivityItem } from '../../services/activity-aggregation.service';
import { getAuthoritySourceLabel, getAuthoritySourceDescription, type AuthoritySource } from '../../types/authority-context';
import { useSession } from '../../contexts/SessionProvider';
import DisputeFormModal from '../dispute/DisputeFormModal';
import { createDispute } from '../../api/disputes';
import './ActivityDetailModal.css';

interface ActivityDetailModalProps {
  activity: ActivityItem;
  onClose: () => void;
}

// Tipos de atividades que podem ser contestadas
const DISPUTABLE_ACTIVITY_TYPES = ['transaction', 'member_added', 'member_removed', 'member_updated'] as const;

export default function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  const { activeActor } = useSession();
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Extrair informações de autoridade do metadata
  const authoritySource = activity.metadata?.authority_source as AuthoritySource | undefined;
  const permissionUsed = activity.metadata?.permission_used as string | undefined;
  const scope = activity.metadata?.scope as string | undefined;

  // Verificar se a atividade pode ser contestada
  const canDispute = DISPUTABLE_ACTIVITY_TYPES.includes(activity.type as any) && 
                     activeActor && 
                     activity.actorId && 
                     activity.actorId !== 'unknown';

  const handleDisputeSubmit = async (reason: any, description: string) => {
    if (!activeActor) {
      throw new Error('Actor não disponível');
    }

    setDisputeSubmitting(true);
    try {
      await createDispute(
        activity.id,
        activity.actorId,
        activeActor.user_id || activeActor.actor_id,
        reason,
        description
      );
      // Disparar evento para atualizar UI
      window.dispatchEvent(new CustomEvent('invalidate-queries'));
    } finally {
      setDisputeSubmitting(false);
    }
  };

  return (
    <div className="activity-detail-modal-overlay" onClick={onClose}>
      <div className="activity-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="activity-detail-header">
          <h3>Detalhes da Atividade</h3>
          <button onClick={onClose} className="activity-detail-close" type="button">
            ×
          </button>
        </div>

        <div className="activity-detail-content">
          <div className="activity-detail-section">
            <h4>O que aconteceu</h4>
            <p className="activity-detail-description">{activity.description}</p>
            <div className="activity-detail-meta">
              <span className="activity-detail-label">Tipo:</span>
              <span className="activity-detail-value">{activity.type}</span>
            </div>
            <div className="activity-detail-meta">
              <span className="activity-detail-label">Data e hora:</span>
              <span className="activity-detail-value">{formatDate(activity.createdAt)}</span>
            </div>
          </div>

          <div className="activity-detail-section">
            <h4>Responsabilidade</h4>
            {activity.actingUserId && (
              <div className="activity-detail-meta">
                <span className="activity-detail-label">Executado por:</span>
                <span className="activity-detail-value" title={activity.actingUserId}>
                  {activity.actingUserId.substring(0, 8)}...
                </span>
              </div>
            )}
            {activity.actorId && activity.actorId !== 'unknown' && (
              <div className="activity-detail-meta">
                <span className="activity-detail-label">Em nome de:</span>
                <span className="activity-detail-value" title={activity.actorId}>
                  {activity.actorId.substring(0, 8)}...
                </span>
              </div>
            )}
            {authoritySource && (
              <div className="activity-detail-meta">
                <span className="activity-detail-label">Autoridade:</span>
                <span className="activity-detail-value" title={getAuthoritySourceDescription(authoritySource)}>
                  {getAuthoritySourceLabel(authoritySource)}
                </span>
              </div>
            )}
            {permissionUsed && (
              <div className="activity-detail-meta">
                <span className="activity-detail-label">Permissão usada:</span>
                <span className="activity-detail-value">{permissionUsed}</span>
              </div>
            )}
            {scope && (
              <div className="activity-detail-meta">
                <span className="activity-detail-label">Escopo:</span>
                <span className="activity-detail-value">{scope}</span>
              </div>
            )}
          </div>

          {Object.keys(activity.metadata).length > 0 && (
            <div className="activity-detail-section">
              <h4>Informações Técnicas</h4>
              <div className="activity-detail-metadata">
                {Object.entries(activity.metadata).map(([key, value]) => (
                  <div key={key} className="activity-detail-meta">
                    <span className="activity-detail-label">{key}:</span>
                    <span className="activity-detail-value">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {canDispute && (
          <div className="activity-detail-actions">
            <button
              onClick={() => setShowDisputeForm(true)}
              className="activity-detail-dispute-button"
              type="button"
            >
              Solicitar Revisão
            </button>
          </div>
        )}
      </div>

      {showDisputeForm && (
        <DisputeFormModal
          activity={activity}
          onClose={() => setShowDisputeForm(false)}
          onSubmit={handleDisputeSubmit}
        />
      )}
    </div>
  );
}







