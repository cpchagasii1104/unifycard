import type { AvailabilityOwnerType } from '../api/availability';

export function useProfileAgendaLogic() {
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      active: 'Ativa',
      paused: 'Pausada',
      cancelled: 'Cancelada',
      requested: 'Solicitado',
      confirmed: 'Confirmado',
      expired: 'Expirado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      active: '#10b981',
      paused: '#f59e0b',
      cancelled: '#ef4444',
      requested: '#3b82f6',
      confirmed: '#10b981',
      expired: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  const getOwnerType = (activeActor: any): AvailabilityOwnerType => {
    if (!activeActor) return 'user';
    if (activeActor.actor_type === 'group') return 'group';
    if (activeActor.actor_type === 'page') return 'user';
    return 'user';
  };

  return {
    formatDate,
    getStatusLabel,
    getStatusColor,
    getOwnerType,
  };
}



