// frontend/src/components/system-notifications/NotificationBell.tsx
// Componente de Badge de Notificações
// 🔴 BLINDAGEM: NÃO executa ações automaticamente

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getUnreadNotificationCount } from '../../api/system-notifications';
import './NotificationBell.css';

interface NotificationBellProps {
  onClick?: () => void;
}

export default function NotificationBell({ onClick }: NotificationBellProps) {
  const { activeActor } = useActiveActor();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeActor) {
      loadUnreadCount();
      // Atualizar contador a cada 30 segundos
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [activeActor]);

  const loadUnreadCount = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await getUnreadNotificationCount(activeActor.actor_id);
      setUnreadCount(result.count);
    } catch (err) {
      console.error('Erro ao carregar contador de notificações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeActor) {
    return null;
  }

  return (
    <div className="notification-bell" onClick={onClick}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {!isLoading && unreadCount > 0 && (
        <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </div>
  );
}




