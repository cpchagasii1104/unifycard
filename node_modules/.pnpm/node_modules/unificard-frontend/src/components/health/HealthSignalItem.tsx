// frontend/src/components/health/HealthSignalItem.tsx
// CONTINUOUS PRODUCTION: Item de Sinal de Saúde - SPRINT 9
// Componente que exibe um sinal individual de saúde

import type { HealthSignal } from '../../types/health-signal';
import './HealthSummaryCard.css';

interface HealthSignalItemProps {
  signal: HealthSignal;
}

export default function HealthSignalItem({ signal }: HealthSignalItemProps) {
  const getStatusIcon = (status: HealthSignal['status']): string => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'attention':
        return 'ℹ';
      case 'critical':
        return '⚠';
      default:
        return '•';
    }
  };

  const getStatusClass = (status: HealthSignal['status']): string => {
    return `health-signal-status-${status}`;
  };

  return (
    <div className={`health-signal-item ${getStatusClass(signal.status)}`}>
      <div className="health-signal-content">
        <div className="health-signal-header">
          <div className="health-signal-icon">
            {getStatusIcon(signal.status)}
          </div>
          <div className="health-signal-title">{signal.title}</div>
        </div>
        <div className="health-signal-description">{signal.description}</div>
        <div className="health-signal-observation">{signal.observation}</div>
        <div className="health-signal-source">{signal.source}</div>
      </div>
    </div>
  );
}







