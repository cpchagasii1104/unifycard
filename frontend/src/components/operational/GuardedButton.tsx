// frontend/src/components/operational/GuardedButton.tsx
// CONTINUOUS PRODUCTION: Botão com Guard Operacional - SPRINT 6
// Botão que se desabilita automaticamente baseado em limites operacionais

import { ReactNode } from 'react';
import { useOperationalGuard } from '../../hooks/useOperationalGuard';
import type { ActionType } from '../../types/operational-state';
import './ActionGuard.css';

interface GuardedButtonProps {
  actionType: ActionType;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  checkPendingActions?: boolean;
  showTooltip?: boolean; // Mostrar tooltip com explicação quando desabilitado
}

/**
 * Botão que aplica guard operacional automaticamente
 * 
 * @example
 * <GuardedButton actionType="invite_member" onClick={handleInvite}>
 *   Convidar Colaborador
 * </GuardedButton>
 */
export default function GuardedButton({
  actionType,
  onClick,
  children,
  className = '',
  checkPendingActions = false,
  showTooltip = true,
}: GuardedButtonProps) {
  const state = useOperationalGuard(actionType, { checkPendingActions });

  const handleClick = () => {
    if (state.canPerform && !state.loading) {
      onClick();
    }
  };

  const isDisabled = !state.canPerform || state.loading;

  return (
    <div className="guarded-button-wrapper" style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`${className} ${isDisabled ? 'action-guard-disabled' : ''}`}
        type="button"
        title={isDisabled && showTooltip ? state.reason : undefined}
      >
        {state.loading ? 'Verificando...' : children}
      </button>
      {isDisabled && state.reason && showTooltip && (
        <div className="action-guard-tooltip">
          {state.reason}
          {state.suggestion && (
            <>
              <br />
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                {state.suggestion}
              </span>
            </>
          )}
        </div>
      )}
      {isDisabled && state.reason && !showTooltip && (
        <div className={`action-guard-hint ${state.severity || 'info'}`}>
          {state.reason}
          {state.suggestion && ` — ${state.suggestion}`}
        </div>
      )}
    </div>
  );
}







