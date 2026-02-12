// frontend/src/hooks/useOperationalGuard.ts
// CONTINUOUS PRODUCTION: Hook de Guard Operacional - SPRINT 6
// Retorna estado operacional para uma ação sem executá-la

import { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionProvider';
import { checkOperationalState, checkBlockingPendingActions } from '../services/operational-limits.service';
import type { OperationalState, ActionType } from '../types/operational-state';
import { isAuthenticated, getTenantId } from '../config/auth';

interface UseOperationalGuardOptions {
  checkPendingActions?: boolean; // Verificar pendências bloqueantes também
}

/**
 * Hook que verifica o estado operacional para uma ação
 */
export function useOperationalGuard(
  actionType: ActionType,
  options: UseOperationalGuardOptions = {}
): OperationalState & { loading: boolean } {
  const { sessionReady, activeActor } = useSession();
  const [state, setState] = useState<OperationalState>({
    canPerform: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setState({
        canPerform: false,
        reason: 'Sessão não disponível',
        severity: 'blocking',
      });
      setLoading(false);
      return;
    }

    loadOperationalState();
  }, [sessionReady, activeActor?.actor_id, actionType]);

  const loadOperationalState = async () => {
    setLoading(true);

    try {
      // 1. Verificar pendências bloqueantes (se solicitado)
      if (options.checkPendingActions) {
        const blockingState = await checkBlockingPendingActions({
          actorId: activeActor!.actor_id,
          actorType: activeActor!.actor_type as 'user' | 'page' | 'group' | 'project',
          userId: activeActor!.actor_type === 'user' ? activeActor!.actor_id : undefined,
          companyId: activeActor!.actor_type === 'page' ? activeActor!.actor_id : undefined,
        });

        if (blockingState && !blockingState.canPerform) {
          setState(blockingState);
          setLoading(false);
          return;
        }
      }

      // 2. Verificar estado operacional específico da ação
      const operationalState = await checkOperationalState(actionType, {
        actorId: activeActor!.actor_id,
        actorType: activeActor!.actor_type as 'user' | 'page' | 'group' | 'project',
        userId: activeActor!.actor_type === 'user' ? activeActor!.actor_id : undefined,
        companyId: activeActor!.actor_type === 'page' ? activeActor!.actor_id : undefined,
      });

      setState(operationalState);
    } catch (error) {
      console.warn('Erro ao verificar estado operacional:', error);
      // Em caso de erro, permitir (backend vai validar)
      setState({
        canPerform: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    ...state,
    loading,
  };
}







