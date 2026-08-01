// src/components/events/EventStatusBadge.tsx
// Badge de status do evento (read-only)
import './EventStatusBadge.css';

export interface EventStatusBadgeProps {
  status: string;
}

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §7
// ║ NÃO:     duplicar este mapa de rótulo/fase em outro arquivo
// ║ EM VEZ:  importar EVENT_STATUS_CONFIG daqui
// ╚════════════════════════════════════════════════════════════════
export const EVENT_STATUS_CONFIG: Record<string, { label: string; className: string; phase: 'pending' | 'live' | 'closed' }> = {
  draft: { label: 'Rascunho — falta concluir', className: 'status-draft', phase: 'pending' },
  declared: { label: 'Declarado — ainda não público', className: 'status-declared', phase: 'pending' },
  published: { label: 'Publicado', className: 'status-published', phase: 'live' },
  active: { label: 'Em andamento', className: 'status-active', phase: 'live' },
  ended: { label: 'Concluído', className: 'status-ended', phase: 'closed' },
  cancelled: { label: 'Cancelado', className: 'status-cancelled', phase: 'closed' },
};

export default function EventStatusBadge({ status }: EventStatusBadgeProps) {
  // draft não renderiza (comportamento original preservado, agora contra o valor real)
  if (status === 'draft') {
    return null;
  }

  const config = EVENT_STATUS_CONFIG[status] || { label: status, className: 'status-default', phase: 'pending' as const };

  return <span className={`event-status-badge ${config.className}`}>{config.label}</span>;
}




























