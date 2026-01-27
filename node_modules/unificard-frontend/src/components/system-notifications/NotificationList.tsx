// frontend/src/components/system-notifications/NotificationList.tsx
// Componente para listar e gerenciar notificações
// 🔴 BLINDAGEM: NÃO executa ações automaticamente

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import {
  listSystemNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type SystemNotification,
} from '../../api/system-notifications';
import { showToast } from '../common/Toast';
import './NotificationList.css';

interface NotificationListProps {
  onNotificationClick?: (notification: SystemNotification) => void;
}

export default function NotificationList({ onNotificationClick }: NotificationListProps) {
  const { activeActor } = useActiveActor();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (activeActor) {
      loadNotifications();
    }
  }, [activeActor, showUnreadOnly]);

  const loadNotifications = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await listSystemNotifications({
        recipientActorId: activeActor.actor_id,
        unreadOnly: showUnreadOnly,
        limit: 50,
      });
      setNotifications(result.notifications);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar notificações');
      showToast(err.message || 'Erro ao carregar notificações', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao marcar notificação como lida', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!activeActor) return;

    try {
      await markAllNotificationsAsRead(activeActor.actor_id);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      showToast('Todas as notificações foram marcadas como lidas', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao marcar todas como lidas', 'error');
    }
  };

  const getContextLink = (notification: SystemNotification): string => {
    const { contextType, contextId } = notification;
    switch (contextType) {
      case 'event':
        return `/events/${contextId}`;
      case 'rfq':
        return `/events/${notification.metadata?.eventId || ''}/rfqs/${contextId}`;
      case 'booking':
        return `/service-orders?bookingId=${contextId}`;
      case 'service_order':
        return `/service-orders/${contextId}`;
      default:
        return '#';
    }
  };

  const handleNotificationClick = (notification: SystemNotification) => {
    if (!notification.readAt) {
      handleMarkAsRead(notification.notificationId);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  if (!activeActor) {
    return <div className="notification-list">Faça login para ver notificações</div>;
  }

  if (isLoading) {
    return (
      <div className="notification-list">
        <div className="loading">Carregando notificações...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notification-list">
        <div className="error">{error}</div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="notification-list">
      <div className="notification-list-header">
        <h3>Notificações</h3>
        <div className="notification-list-actions">
          <label>
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
            />
            Apenas não lidas
          </label>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="btn-mark-all-read">
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="no-notifications">
          <p>Nenhuma notificação {showUnreadOnly ? 'não lida' : ''}.</p>
        </div>
      ) : (
        <div className="notifications-items">
          {notifications.map((notification) => (
            <div
              key={notification.notificationId}
              className={`notification-item ${!notification.readAt ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-content">
                <p className="notification-message">{notification.message}</p>
                <div className="notification-meta">
                  <span className="notification-type">{notification.type}</span>
                  <span className="notification-time">
                    {new Date(notification.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
              {!notification.readAt && (
                <div className="notification-unread-indicator" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




