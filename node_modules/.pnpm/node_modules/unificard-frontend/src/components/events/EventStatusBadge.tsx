// src/components/events/EventStatusBadge.tsx
// Badge de status do evento (read-only)
import './EventStatusBadge.css';

export interface EventStatusBadgeProps {
  status: string;
}

export default function EventStatusBadge({ status }: EventStatusBadgeProps) {
  // DRAFT não renderiza conforme prompt
  if (status === 'DRAFT') {
    return null;
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    PUBLISHED: { label: 'Publicado', className: 'status-published' },
    ONGOING: { label: 'Em andamento', className: 'status-ongoing' },
    SOLD_OUT: { label: 'Esgotado', className: 'status-sold-out' },
    CANCELLED: { label: 'Cancelado', className: 'status-cancelled' },
    FINISHED: { label: 'Finalizado', className: 'status-finished' },
  };

  const config = statusConfig[status] || { label: status, className: 'status-default' };

  return <span className={`event-status-badge ${config.className}`}>{config.label}</span>;
}















