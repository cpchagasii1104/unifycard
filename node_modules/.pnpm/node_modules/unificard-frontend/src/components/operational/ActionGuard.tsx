// frontend/src/components/operational/ActionGuard.tsx
// CONTINUOUS PRODUCTION: Componente de Guard para Ações - SPRINT 6
// Envolve botões/ações e aplica limites operacionais

import { ReactNode } from 'react';
import { useOperationalGuard } from '../../hooks/useOperationalGuard';
import type { ActionType } from '../../types/operational-state';
import './ActionGuard.css';

interface ActionGuardProps {
  actionType: ActionType;
  children: (state: {
    canPerform: boolean;
    reason?: string;
    suggestion?: string;
    loading: boolean;
  }) => ReactNode;
  checkPendingActions?: boolean;
}

/**
 * Componente que aplica guard operacional a uma ação
 * 
 * @example
 * <ActionGuard actionType="create_service">
 *   {({ canPerform, reason, loading }) => (
 *     <button disabled={!canPerform || loading} title={reason}>
 *       Criar Serviço
 *     </button>
 *   )}
 * </ActionGuard>
 */
export default function ActionGuard({
  actionType,
  children,
  checkPendingActions = false,
}: ActionGuardProps) {
  const state = useOperationalGuard(actionType, { checkPendingActions });

  return (
    <>
      {children({
        canPerform: state.canPerform,
        reason: state.reason,
        suggestion: state.suggestion,
        loading: state.loading,
      })}
    </>
  );
}







