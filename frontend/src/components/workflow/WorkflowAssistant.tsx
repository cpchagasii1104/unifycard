// frontend/src/components/workflow/WorkflowAssistant.tsx
// CONTINUOUS PRODUCTION: Assistente de Workflow - SPRINT 7
import { LinearityBreakText } from '../../utils/action-nature';
import { calculateTemporalState, getTemporalStateText } from '../../utils/temporal-state';
import { PassiveConfirmation, CoherenceSignal } from '../../utils/functioning-evidence';
import { ClosureText } from '../../utils/closure-continuity';
// Componente que exibe fluxos reais de trabalho baseados em estado real

// Stub for MemoryText (not yet implemented)
const MemoryText = ({ type }: { type: string }) => null;

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { detectActiveWorkflow } from '../../services/workflow-detection.service';
import type { Workflow } from '../../types/workflow';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { useActionExecutor } from '../../hooks/useActionExecutor';
import { observePilotEvent } from '../../services/pilot-observer.service';
import ActionFeedback from '../feedback/ActionFeedback';
import './WorkflowAssistant.css';

interface WorkflowAssistantProps {
  maxSteps?: number; // Limitar número de passos exibidos
}

export default function WorkflowAssistant({ maxSteps = 3 }: WorkflowAssistantProps) {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadWorkflow = useCallback(async () => {
    if (!activeActor) return;

    setLoading(true);
    setError(null);

    try {
      const detected = await detectActiveWorkflow({
        actorId: activeActor.actor_id,
        actorType: activeActor.actor_type as 'user' | 'page' | 'group' | 'project',
        userId: activeActor.actor_type === 'user' ? activeActor.actor_id : undefined,
        companyId: activeActor.actor_type === 'page' ? activeActor.actor_id : undefined,
      });

      setWorkflow(detected);

      // Observar primeiro workflow completado
      if (detected && detected.status === 'completed' && activeActor) {
        observePilotEvent('first_workflow_completed', activeActor.actor_id, activeActor.actor_type, {
          workflowId: detected.id,
        });
      }
    } catch (err: any) {
      console.warn('Erro ao carregar workflow:', err);
      setError(err.message || 'Erro ao carregar workflow');
    } finally {
      setLoading(false);
    }
  }, [activeActor]);

  const actionExecutor = useActionExecutor({
    invalidateQueries: true,
    onSuccess: () => {
      // Recarregar workflow após ação bem-sucedida
      loadWorkflow();
    },
  });

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadWorkflow();
  }, [sessionReady, activeActor?.actor_id]);

  // Escutar evento de invalidação de queries para recarregar workflow
  useEffect(() => {
    const handleInvalidateQueries = () => {
      if (sessionReady && isAuthenticated() && getTenantId() && activeActor) {
        loadWorkflow();
      }
    };

    window.addEventListener('invalidate-queries', handleInvalidateQueries);
    return () => {
      window.removeEventListener('invalidate-queries', handleInvalidateQueries);
    };
  }, [sessionReady, activeActor, loadWorkflow]);

  const handleStepAction = async (step: Workflow['steps'][0]) => {
    if (step.isBlocked) {
      return; // Não executar se bloqueado
    }

    // Se ação tem onClick customizado, usar
    if (step.action?.onClick) {
      step.action.onClick();
      return;
    }

    // Se ação tem path, navegar ou executar ação contextual
    if (step.action?.path) {
      // Verificar se é uma ação executável ou apenas navegação
      const stepId = step.id;
      
      // Ações executáveis diretamente
      if (stepId === 'create_company' && step.action.path === '/empresas') {
        // Navegar para criação (não executar diretamente, pois precisa de formulário)
        navigate(step.action.path);
      } else {
        // Outras ações: navegar normalmente
        navigate(step.action.path);
      }
    }
  };

  if (loading) {
    return (
      <div className="workflow-assistant">
        <div className="workflow-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Não mostrar erro, apenas não exibir workflow
  }

  // SPRINT 20: Exibir workflow concluído com texto de encerramento
  if (!workflow || workflow.status === 'not_applicable') {
    return null;
  }

  if (workflow.status === 'completed') {
    return (
      <div className="workflow-assistant">
        <div className="workflow-header">
          <h3>{workflow.title}</h3>
        </div>
        <div className="workflow-description">
          <p>{workflow.description}</p>
          {/* SPRINT 20: Encerramento explícito */}
          <ClosureText type="workflow" />
          {/* SPRINT 20: Memória institucional */}
          <MemoryText type="completed" />
          {/* SPRINT 21: Evidência de funcionamento */}
          <PassiveConfirmation type="workflow" />
          <CoherenceSignal type="processed" />
        </div>
      </div>
    );
  }

  const currentStep = workflow.steps[workflow.currentStepIndex];
  const visibleSteps = workflow.steps.slice(0, maxSteps);

  // SPRINT 19: Calcular estado temporal
  const workflowCreatedAt = workflow.metadata?.createdAt 
    ? new Date(workflow.metadata.createdAt)
    : new Date(); // Fallback para agora se não houver metadata
  const workflowUpdatedAt = workflow.metadata?.updatedAt
    ? new Date(workflow.metadata.updatedAt)
    : workflowCreatedAt;
  const temporalState = calculateTemporalState(workflowCreatedAt, workflowUpdatedAt);
  const temporalText = getTemporalStateText(
    temporalState,
    'workflow',
    workflowCreatedAt,
    workflowUpdatedAt
  );

  return (
    <div className="workflow-assistant">
      <div className="workflow-header">
        <h3>Caminho Sugerido
          {/* SPRINT 18: Marcação de natureza */}
          <span
            style={{
              fontSize: '0.75rem',
              color: '#999',
              fontStyle: 'italic',
              marginLeft: '0.5rem',
            }}
          >
            Sugestão
          </span>
        </h3>
        <span className="workflow-title">{workflow.title}</span>
      </div>

      <div className="workflow-description">
        <p>{workflow.description}</p>
        {/* SPRINT 19: Estado temporal */}
        {temporalText && (
          <p style={{
            fontSize: '0.85rem',
            color: '#666',
            fontStyle: 'italic',
            marginTop: '0.5rem',
          }}>
            {temporalText}
          </p>
        )}
        {/* SPRINT 18: Quebra de linearidade */}
        <LinearityBreakText context="workflows" />
      </div>

      {actionExecutor.result && (
        <ActionFeedback result={actionExecutor.result} />
      )}

      {currentStep && (
        <div className="workflow-current-step">
          <div className="workflow-step-content">
            <div className="workflow-step-title">
              <span className="workflow-step-icon">→</span>
              {currentStep.title}
            </div>
            <div className="workflow-step-description">
              {currentStep.description}
            </div>
            {currentStep.action && (
              <button
                onClick={() => handleStepAction(currentStep)}
                className="workflow-step-action"
                type="button"
                disabled={currentStep.isBlocked || actionExecutor.executing}
                title={currentStep.blockingReason || actionExecutor.guardReason}
              >
                {actionExecutor.executing ? 'Executando...' : currentStep.action.label}
              </button>
            )}
            {currentStep.blockingReason && (
              <div className="workflow-step-blocked">
                {currentStep.blockingReason}
              </div>
            )}
          </div>
        </div>
      )}

      {visibleSteps.length > 1 && (
        <div className="workflow-steps-preview">
          <div className="workflow-steps-label">Próximos passos:</div>
          <div className="workflow-steps-list">
            {visibleSteps.slice(1).map((step, index) => (
              <div
                key={step.id}
                className={`workflow-step-preview ${step.isCompleted ? 'completed' : ''} ${step.isBlocked ? 'blocked' : ''}`}
              >
                <span className="workflow-step-preview-icon">
                  {step.isCompleted ? '✓' : step.isBlocked ? '⚠' : '○'}
                </span>
                <span className="workflow-step-preview-title">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


