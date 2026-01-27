// frontend/src/hooks/useActionExecutor.ts
// CONTINUOUS PRODUCTION: Hook de Execução de Ações - SPRINT 8
// Executa ações com feedback imediato e atualização automática

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionProvider';
import { useOperationalGuard } from './useOperationalGuard';
import type { ActionType } from '../types/operational-state';
import * as actionHandlers from '../handlers/action-handlers';
import type { ActionResult } from '../handlers/action-handlers';
import { observePilotEvent } from '../services/pilot-observer.service';

interface UseActionExecutorOptions {
  actionType?: ActionType; // Verificar guard antes de executar
  checkPendingActions?: boolean;
  onSuccess?: (result: ActionResult) => void;
  onError?: (result: ActionResult) => void;
  invalidateQueries?: boolean; // Invalidar queries após sucesso
}

interface ActionExecutorState {
  executing: boolean;
  result: ActionResult | null;
}

/**
 * Hook que executa ações com feedback e atualização automática
 */
export function useActionExecutor(options: UseActionExecutorOptions = {}) {
  const navigate = useNavigate();
  const { activeActor } = useSession();
  const [state, setState] = useState<ActionExecutorState>({
    executing: false,
    result: null,
  });

  // Verificar guard se actionType fornecido
  const guardState = options.actionType
    ? useOperationalGuard(options.actionType, { checkPendingActions: options.checkPendingActions })
    : null;

  const execute = useCallback(async (
    handler: () => Promise<ActionResult>,
    navigationPath?: string
  ) => {
    // Verificar guard se necessário
    if (guardState && !guardState.canPerform) {
      setState({
        executing: false,
        result: {
          success: false,
          error: guardState.reason || 'Ação não permitida',
          message: guardState.reason || 'Esta ação não está disponível no momento.',
        },
      });
      if (options.onError) {
        options.onError({
          success: false,
          error: guardState.reason || 'Ação não permitida',
          message: guardState.reason || 'Esta ação não está disponível no momento.',
        });
      }
      return;
    }

    setState({ executing: true, result: null });

    try {
      const result = await handler();

      setState({ executing: false, result });

      if (result.success) {
        // Observar primeiro evento de ação executada
        if (activeActor) {
          observePilotEvent('first_action_executed', activeActor.actor_id, activeActor.actor_type, {
            actionType: options.actionType,
          });
        }

        // Invalidar queries para atualizar UI
        if (options.invalidateQueries !== false) {
          window.dispatchEvent(new CustomEvent('invalidate-queries', {
            detail: { reason: 'action-executed' },
          }));
        }

        // Callback de sucesso
        if (options.onSuccess) {
          options.onSuccess(result);
        }

        // Navegar se path fornecido
        if (navigationPath) {
          navigate(navigationPath);
        }
      } else {
        // Callback de erro
        if (options.onError) {
          options.onError(result);
        }
      }
    } catch (error: any) {
      const errorResult: ActionResult = {
        success: false,
        error: error.message || 'Erro inesperado',
        message: error.message || 'Ocorreu um erro ao executar a ação.',
      };
      setState({ executing: false, result: errorResult });
      if (options.onError) {
        options.onError(errorResult);
      }
    }
  }, [guardState, navigate, options]);

  return {
    execute,
    executing: state.executing,
    result: state.result,
    canExecute: guardState ? guardState.canPerform : true,
    guardReason: guardState?.reason,
  };
}







