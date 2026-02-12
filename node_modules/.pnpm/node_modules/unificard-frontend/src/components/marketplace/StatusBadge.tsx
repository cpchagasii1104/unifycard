// src/components/marketplace/StatusBadge.tsx
// Badge visual para status de entidades do marketplace
import './StatusBadge.css';

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'payment' | 'payout';
}

export default function StatusBadge({ status, type = 'order' }: StatusBadgeProps) {
  const getStatusConfig = () => {
    const upperStatus = status.toUpperCase();
    
    if (type === 'order') {
      switch (upperStatus) {
        case 'DRAFT':
          return { label: 'Rascunho', className: 'status-draft' };
        case 'SUBMITTED':
          return { label: 'Submetido', className: 'status-submitted' };
        case 'CANCELLED':
          return { label: 'Cancelado', className: 'status-cancelled' };
        case 'EXPIRED':
          return { label: 'Expirado', className: 'status-expired' };
        default:
          return { label: status, className: 'status-default' };
      }
    }
    
    if (type === 'payment') {
      switch (upperStatus) {
        case 'CREATED':
          return { label: 'Criado', className: 'status-created' };
        case 'AUTHORIZED':
          return { label: 'Autorizado', className: 'status-authorized' };
        case 'FAILED':
          return { label: 'Falhou', className: 'status-failed' };
        case 'CANCELLED':
          return { label: 'Cancelado', className: 'status-cancelled' };
        case 'PENDING':
          return { label: 'Pendente', className: 'status-pending' };
        case 'SUCCESS':
          return { label: 'Sucesso', className: 'status-success' };
        default:
          return { label: status, className: 'status-default' };
      }
    }
    
    if (type === 'payout') {
      switch (upperStatus) {
        case 'PENDING':
          return { label: 'Pendente', className: 'status-pending' };
        case 'SUCCESS':
          return { label: 'Sucesso', className: 'status-success' };
        case 'FAILED':
          return { label: 'Falhou', className: 'status-failed' };
        default:
          return { label: status, className: 'status-default' };
      }
    }
    
    return { label: status, className: 'status-default' };
  };

  const config = getStatusConfig();

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}







