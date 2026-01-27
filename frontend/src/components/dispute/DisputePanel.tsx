// frontend/src/components/dispute/DisputePanel.tsx
// CONTINUOUS PRODUCTION: Painel de Disputas - SPRINT 11
import { calculateTemporalState, getTemporalStateText, replaceImplicitTime, getAbsenceText } from '../../utils/temporal-state';
import { ClosureText, MemoryText } from '../../utils/closure-continuity';
import { InstitutionalPulse } from '../../utils/institutional-pulse';
// Exibe disputas abertas e permite resolução

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { listOpenDisputes, resolveDispute, rejectDispute, revertDispute } from '../../api/disputes';
import { aggregateActivities } from '../../services/activity-aggregation.service';
import { getDisputeStatusLabel, getDisputeReasonLabel, type Dispute, type DisputeStatus } from '../../types/dispute';
import { isAuthenticated, getTenantId } from '../../config/auth';
import DisputeResolutionModal from './DisputeResolutionModal';
import './DisputePanel.css';

interface DisputePanelProps {
  actorId: string;
  maxItems?: number;
}

export default function DisputePanel({ actorId, maxItems = 10 }: DisputePanelProps) {
  const { sessionReady, activeActor } = useSession();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [activities, setActivities] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const loadDisputes = useCallback(async () => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const openDisputes = await listOpenDisputes(actorId);
      setDisputes(openDisputes.slice(0, maxItems));

      // Carregar atividades relacionadas
      const activityIds = openDisputes.map(d => d.relatedActivityId);
      const allActivities = await aggregateActivities({ actorId, limit: 100 });
      const activityMap = new Map();
      allActivities.forEach(act => {
        if (activityIds.includes(act.id)) {
          activityMap.set(act.id, act);
        }
      });
      setActivities(activityMap);
    } catch (err: any) {
      console.warn('Erro ao carregar disputas:', err);
      setError(err.message || 'Erro ao carregar disputas');
    } finally {
      setLoading(false);
    }
  }, [sessionReady, actorId, activeActor, maxItems]);

  useEffect(() => {
    loadDisputes();

    // Escutar eventos de invalidação
    const handleInvalidate = () => {
      loadDisputes();
    };
    window.addEventListener('invalidate-queries', handleInvalidate);
    return () => window.removeEventListener('invalidate-queries', handleInvalidate);
  }, [loadDisputes]);

  const handleResolve = async (disputeId: string, resolutionNote?: string) => {
    if (!activeActor) return;

    try {
      await resolveDispute(disputeId, activeActor.user_id || activeActor.actor_id, resolutionNote);
      window.dispatchEvent(new CustomEvent('invalidate-queries'));
      setSelectedDispute(null);
      loadDisputes();
    } catch (err: any) {
      console.error('Erro ao resolver disputa:', err);
      alert(err.message || 'Erro ao resolver disputa');
    }
  };

  const handleReject = async (disputeId: string, resolutionNote?: string) => {
    if (!activeActor) return;

    try {
      await rejectDispute(disputeId, activeActor.user_id || activeActor.actor_id, resolutionNote);
      window.dispatchEvent(new CustomEvent('invalidate-queries'));
      setSelectedDispute(null);
      loadDisputes();
    } catch (err: any) {
      console.error('Erro ao rejeitar disputa:', err);
      alert(err.message || 'Erro ao rejeitar disputa');
    }
  };

  const handleRevert = async (disputeId: string, transactionId: string, resolutionNote?: string) => {
    if (!activeActor) return;

    try {
      await revertDispute(disputeId, activeActor.user_id || activeActor.actor_id, transactionId, resolutionNote);
      window.dispatchEvent(new CustomEvent('invalidate-queries'));
      setSelectedDispute(null);
      loadDisputes();
    } catch (err: any) {
      console.error('Erro ao reverter disputa:', err);
      alert(err.message || 'Erro ao reverter disputa');
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
      <div className="dispute-panel">
        <div className="dispute-panel-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dispute-panel">
        <div className="dispute-panel-error">
          <p>Erro ao carregar disputas: {error}</p>
        </div>
      </div>
    );
  }

  if (disputes.length === 0) {
    return (
      <div className="dispute-panel">
        <div className="dispute-panel-empty">
          <p>Nenhuma solicitação de revisão aberta</p>
          {/* SPRINT 19: Diferenciar ausência */}
          <p style={{
            fontSize: '0.85rem',
            color: '#999',
            fontStyle: 'italic',
            marginTop: '0.5rem',
          }}>
            {getAbsenceText('not_happened')}
          </p>
          {/* SPRINT 22: Pulso institucional em estado vazio */}
          <InstitutionalPulse type="noInconsistencies" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dispute-panel">
        <div className="dispute-panel-header">
          <h3>Solicitações de Revisão</h3>
          <p className="dispute-panel-subtitle">
            {disputes.length} {disputes.length === 1 ? 'solicitação aberta' : 'solicitações abertas'}
          </p>
        </div>

        <div className="dispute-panel-list">
          {disputes.map((dispute) => {
            const relatedActivity = activities.get(dispute.relatedActivityId);
            return (
              <div
                key={dispute.id}
                className="dispute-panel-item"
                onClick={() => setSelectedDispute(dispute)}
                style={{ cursor: 'pointer' }}
              >
                <div className="dispute-panel-item-header">
                  <span className="dispute-panel-status dispute-panel-status-open">
                    {getDisputeStatusLabel(dispute.status)}
                  </span>
                  {/* SPRINT 19: Tempo explícito ao invés de data absoluta */}
                  <span className="dispute-panel-date">
                    {replaceImplicitTime('pending', dispute.openedAt, { includeAbsolute: true })}
                  </span>
                </div>
                {/* SPRINT 19: Estado temporal */}
                {(() => {
                  const temporalState = calculateTemporalState(
                    dispute.openedAt,
                    dispute.resolvedAt || dispute.openedAt,
                    dispute.status === 'resolved' ? dispute.resolvedAt : undefined
                  );
                  const temporalText = getTemporalStateText(
                    temporalState,
                    'dispute',
                    dispute.openedAt,
                    dispute.resolvedAt || dispute.openedAt,
                    dispute.status === 'resolved' ? dispute.resolvedAt : undefined
                  );
                  return temporalText ? (
                    <p style={{
                      fontSize: '0.8rem',
                      color: '#999',
                      fontStyle: 'italic',
                      marginTop: '0.25rem',
                    }}>
                      {temporalText}
                    </p>
                  ) : null;
                })()}
                {/* SPRINT 20: Encerramento explícito para disputas resolvidas */}
                {dispute.status === 'resolved' && (
                  <ClosureText type="dispute" />
                )}
                {/* SPRINT 20: Memória institucional para disputas resolvidas */}
                {dispute.status === 'resolved' && dispute.resolvedAt && (
                  <MemoryText type="resolved" />
                )}
                {relatedActivity && (
                  <div className="dispute-panel-activity">
                    {relatedActivity.description}
                  </div>
                )}
                <div className="dispute-panel-reason">
                  <strong>Motivo:</strong> {getDisputeReasonLabel(dispute.reason)}
                </div>
                <div className="dispute-panel-description">
                  {dispute.description}
                </div>
                <div className="dispute-panel-opened-by">
                  Aberta por: {dispute.openedByUserId.substring(0, 8)}...
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDispute && (
        <DisputeResolutionModal
          dispute={selectedDispute}
          relatedActivity={activities.get(selectedDispute.relatedActivityId)}
          onClose={() => setSelectedDispute(null)}
          onResolve={handleResolve}
          onReject={handleReject}
          onRevert={handleRevert}
        />
      )}
    </>
  );
}


