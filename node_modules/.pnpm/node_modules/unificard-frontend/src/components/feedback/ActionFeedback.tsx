// frontend/src/components/feedback/ActionFeedback.tsx
// CONTINUOUS PRODUCTION: Feedback de Ação - SPRINT 8
// Componente que exibe feedback imediato após execução de ações

import { useEffect, useState } from 'react';
import type { ActionResult } from '../../handlers/action-handlers';
import './ActionFeedback.css';

interface ActionFeedbackProps {
  result: ActionResult | null;
  autoHide?: boolean; // Esconder automaticamente após alguns segundos
  autoHideDelay?: number; // Delay em ms (padrão: 3000)
}

/**
 * Componente que exibe feedback de ação executada
 */
export default function ActionFeedback({
  result,
  autoHide = true,
  autoHideDelay = 3000,
}: ActionFeedbackProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      if (autoHide && result.success) {
        const timer = setTimeout(() => {
          setVisible(false);
        }, autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [result, autoHide, autoHideDelay]);

  if (!result || !visible) {
    return null;
  }

  return (
    <div className={`action-feedback ${result.success ? 'success' : 'error'}`}>
      <div className="action-feedback-icon">
        {result.success ? '✓' : '⚠'}
      </div>
      <div className="action-feedback-message">
        {result.message || (result.success ? 'Ação executada com sucesso' : result.error)}
      </div>
    </div>
  );
}







