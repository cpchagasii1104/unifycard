// frontend/src/components/pending-actions/PendingActionsCenter.tsx
// CONTINUOUS PRODUCTION: Central de Ações - SPRINT 5
// Componente que exibe pendências reais e oferece ações claras
import { LinearityBreakText } from '../../utils/action-nature';
import { replaceImplicitTime, getAbsenceText } from '../../utils/temporal-state';
import { InstitutionalPulse } from '../../utils/institutional-pulse';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { detectPendingActions } from '../../services/pending-actions.service';
import type { PendingAction } from '../../types/pending-action';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { useActionExecutor } from '../../hooks/useActionExecutor';
import ActionFeedback from '../feedback/ActionFeedback';
import './PendingActionsCenter.css';

interface PendingActionsCenterProps {
  maxItems?: number; // Limitar número de itens exibidos
  showEmptyState?: boolean; // Mostrar mensagem quando não há pendências
}

export default function PendingActionsCenter({ 
  maxItems = 5,
  showEmptyState = true 
}: PendingActionsCenterProps) {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadPendingActions = useCallback(async () => {
    if (!activeActor) return;

    setLoading(true);
    setError(null);

    try {
      const detected = await detectPendingActions({
        actorId: activeActor.actor_id,
        actorType: activeActor.actor_type as 'user' | 'page' | 'group' | 'project',
        userId: activeActor.actor_type === 'user' ? activeActor.actor_id : undefined,
      });

      setActions(detected.slice(0, maxItems));
    } catch (err: any) {
      console.warn('Erro ao carregar pendências:', err);
      setError(err.message || 'Erro ao carregar pendências');
    } finally {
      setLoading(false);
    }
  }, [activeActor, maxItems]);

  const actionExecutor = useActionExecutor({
    invalidateQueries: true,
    onSuccess: () => {
      // Recarregar pendências após ação bem-sucedida
      loadPendingActions();
    },
  });

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadPendingActions();
  }, [sessionReady, activeActor?.actor_id]);

  // Escutar evento de invalidação de queries para recarregar pendências
  useEffect(() => {
    const handleInvalidateQueries = () => {
      if (sessionReady && isAuthenticated() && getTenantId() && activeActor) {
        loadPendingActions();
      }
    };

    window.addEventListener('invalidate-queries', handleInvalidateQueries);
    return () => {
      window.removeEventListener('invalidate-queries', handleInvalidateQueries);
    };
  }, [sessionReady, activeActor, loadPendingActions]);

  const handleAction = async (action: PendingAction) => {
    // Se ação tem onClick customizado, usar
    if (action.action?.onClick) {
      action.action.onClick();
      return;
    }

    // Se ação tem path, navegar
    if (action.action?.path) {
      navigate(action.action.path);
    }
  };

  const getSeverityIcon = (severity: PendingAction['severity']): string => {
    switch (severity) {
      case 'blocking':
        return '⚠️';
      case 'attention':
        return 'ℹ️';
      case 'info':
        return '💡';
      default:
        return '•';
    }
  };

  const getSeverityClass = (severity: PendingAction['severity']): string => {
    return `pending-action-severity-${severity}`;
  };

  if (loading) {
    return (
      <div className="pending-actions-center">
        <div className="pending-actions-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pending-actions-center">
        <div className="pending-actions-error">
          <p>Erro ao carregar pendências</p>
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    if (!showEmptyState) {
      return null;
    }
    return (
      <div className="pending-actions-center">
      <div className="pending-actions-empty">
        <p>Não há pendências no momento</p>
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
    <div className="pending-actions-center">
      {actionExecutor.result && (
        <ActionFeedback result={actionExecutor.result} />
      )}

      <div className="pending-actions-header">
        <h3>Suas Pendências</h3>
        <span className="pending-actions-count">{actions.length}</span>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        {/* SPRINT 18: Marcação de natureza */}
        <span
          style={{
            fontSize: '0.75rem',
            color: '#999',
            fontStyle: 'italic',
          }}
        >
          Estado
        </span>
      </div>

      {/* SPRINT 18: Quebra de linearidade */}
      <LinearityBreakText context="pending" />

      <div className="pending-actions-list">
        {actions.map((action) => {
          // SPRINT 19: Substituir "pendente" por tempo explícito
          const timeText = replaceImplicitTime('pending', action.createdAt);
          return (
            <div 
              key={action.id} 
              className={`pending-action-item ${getSeverityClass(action.severity)}`}
            >
              <div className="pending-action-content">
                <div className="pending-action-icon">
                  {getSeverityIcon(action.severity)}
                </div>
                <div className="pending-action-message">
                  {action.message}
                  {/* SPRINT 19: Tempo explícito */}
                  <span style={{
                    fontSize: '0.8rem',
                    color: '#999',
                    fontStyle: 'italic',
                    marginLeft: '0.5rem',
                  }}>
                    {timeText}
                  </span>
                </div>
              </div>
            {action.action && (
              <button
                onClick={() => handleAction(action)}
                className="pending-action-button"
                type="button"
                disabled={actionExecutor.executing}
              >
                {actionExecutor.executing ? 'Executando...' : action.action.label}
              </button>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


