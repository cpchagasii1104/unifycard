// frontend/src/pages/AlertsPage.tsx
// SPRINT 50: Página de alertas operacionais
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34 (severity) + §4.11 (status)
// ║ NÃO:     comparar severity contra LOW/MEDIUM/HIGH/CRITICAL nem status contra
// ║          OPEN/ACK/RESOLVED (maiúsculo) — nenhum dos dois bate com os enums vivos.
// ║ EM VEZ:  severity ∈ {CRITICAL,ERROR,WARNING,INFO,AUDIT}; status ∈ {open,ack,resolved}.
// ╚════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { listAlerts, updateAlertStatus, type Alert, type AlertStatus } from '../api/automation';
import { showToast } from '../utils/toast';
import './AlertsPage.css';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AlertStatus | 'ALL'>('ALL');

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAlerts({
        status: filter !== 'ALL' ? filter : undefined,
        limit: 100,
      });
      setAlerts(data.alerts);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar alertas';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Erro ao carregar alertas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (alertId: string, newStatus: AlertStatus) => {
    try {
      await updateAlertStatus(alertId, { status: newStatus });
      showToast(`Alerta ${newStatus === 'ack' ? 'reconhecido' : 'resolvido'}`, 'success');
      loadAlerts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar alerta';
      showToast(errorMessage, 'error');
      console.error('Erro ao atualizar alerta:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return '#d32f2f';
      case 'ERROR':
        return '#f57c00';
      case 'WARNING':
        return '#fbc02d';
      case 'INFO':
        return '#388e3c';
      case 'AUDIT':
        return '#607d8b';
      default:
        return '#666';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      INVENTORY_LOW_STOCK: 'Estoque Baixo',
      INVENTORY_OUT_OF_STOCK: 'Estoque Zerado',
      PAYMENT_FAILED: 'Pagamento Falhou',
      PAYOUT_FAILED: 'Payout Falhou',
      FISCAL_PENDING: 'Fiscal Pendente',
      ORDER_EXPIRED: 'Pedido Expirado',
      RESERVATION_EXPIRED: 'Reserva Expirada',
      OTHER: 'Outro',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="alerts-page">
        <div className="alerts-loading">Carregando alertas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-page">
        <div className="alerts-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <h1 className="alerts-title">Alertas Operacionais</h1>
        <div className="alerts-filters">
          <button
            className={`alerts-filter-btn ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            Todos
          </button>
          <button
            className={`alerts-filter-btn ${filter === 'open' ? 'active' : ''}`}
            onClick={() => setFilter('open')}
          >
            Abertos
          </button>
          <button
            className={`alerts-filter-btn ${filter === 'ack' ? 'active' : ''}`}
            onClick={() => setFilter('ack')}
          >
            Reconhecidos
          </button>
          <button
            className={`alerts-filter-btn ${filter === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilter('resolved')}
          >
            Resolvidos
          </button>
        </div>
      </div>

      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="alerts-empty">Nenhum alerta encontrado</div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="alerts-item">
              <div className="alerts-item-header">
                <div className="alerts-item-severity" style={{ backgroundColor: getSeverityColor(alert.severity) }}>
                  {alert.severity}
                </div>
                <div className="alerts-item-type">{getTypeLabel(alert.type)}</div>
                <div className="alerts-item-date">
                  {new Date(alert.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="alerts-item-message">{alert.message}</div>
              {alert.entityType && alert.entityId && (
                <div className="alerts-item-entity">
                  {alert.entityType}: {alert.entityId.substring(0, 8)}...
                </div>
              )}
              <div className="alerts-item-actions">
                {alert.status === 'open' && (
                  <>
                    <button
                      className="alerts-action-btn ack"
                      onClick={() => handleUpdateStatus(alert.id, 'ack')}
                    >
                      Reconhecer
                    </button>
                    <button
                      className="alerts-action-btn resolve"
                      onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                    >
                      Resolver
                    </button>
                  </>
                )}
                {alert.status === 'ack' && (
                  <button
                    className="alerts-action-btn resolve"
                    onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                  >
                    Resolver
                  </button>
                )}
                {alert.status === 'resolved' && (
                  <span className="alerts-resolved-badge">Resolvido</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}







