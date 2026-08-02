// frontend/src/pages/MyOrdersPage.tsx
// My Orders & Purchases Hub - Central Unificada do Comprador
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyOrders, getMyOrdersStats, type MyOrderItem, type MyOrdersStats, type MyOrdersFilters, type OrderType, type OrderStatus } from '../api/my-orders';
import { showToast } from '../utils/toast';
import './MyOrdersPage.css';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MyOrderItem[]>([]);
  const [stats, setStats] = useState<MyOrdersStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MyOrdersFilters>({
    limit: 100,
  });
  const [activeTab, setActiveTab] = useState<'all' | 'negotiation' | 'in_execution' | 'completed' | 'cancelled' | 'disputed'>('all');

  useEffect(() => {
    loadData();
  }, [filters, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersData, statsData] = await Promise.all([
        listMyOrders({
          ...filters,
          status: activeTab !== 'all' ? activeTab : undefined,
        }),
        getMyOrdersStats(),
      ]);

      setOrders(ordersData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pedidos');
      console.error('Erro ao carregar pedidos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number | null, currency: string) => {
    if (cents === null) return '-';
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const getOrderTypeLabel = (type: OrderType) => {
    const labels: Record<OrderType, string> = {
      rfq: 'RFQ / Orçamento',
      booking: 'Booking',
      service_order: 'Ordem de Serviço',
      agreement: 'Acordo',
      bundle: 'Pacote',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: OrderStatus) => {
    const labels: Record<OrderStatus, string> = {
      negotiation: 'Em Negociação',
      agreement_finalized: 'Acordo Finalizado',
      in_execution: 'Em Execução',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      disputed: 'Em Disputa',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      negotiation: '#f59e0b',
      agreement_finalized: '#3b82f6',
      in_execution: '#8b5cf6',
      completed: '#10b981',
      cancelled: '#6b7280',
      disputed: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getRiskLevelColor = (riskLevel: string | null) => {
    if (!riskLevel) return '#6b7280';
    const colors: Record<string, string> = {
      LOW: '#10b981',
      MEDIUM: '#f59e0b',
      HIGH: '#ef4444',
      BLOCKED: '#dc2626',
    };
    return colors[riskLevel] || '#6b7280';
  };

  const handleViewChat = (threadId: string | null) => {
    if (threadId) {
      navigate(`/chat/${threadId}`);
    } else {
      showToast('Chat não disponível para este pedido', 'info');
    }
  };

  const handleViewAgreement = (agreementId: string | null) => {
    if (agreementId) {
      navigate(`/agreements/${agreementId}`);
    } else {
      showToast('Acordo não disponível para este pedido', 'info');
    }
  };

  const handleViewEvidence = (evidencePackId: string | null) => {
    if (evidencePackId) {
      navigate(`/evidence/${evidencePackId}`);
    } else {
      showToast('Evidence Pack não disponível para este pedido', 'info');
    }
  };

  const handleDownloadInvoice = async (invoiceId: string | null) => {
    if (!invoiceId) {
      showToast('Invoice não disponível para este pedido', 'info');
      return;
    }

    try {
      // TODO: Implementar download de invoice
      showToast('Download de invoice em desenvolvimento', 'info');
    } catch (err: any) {
      showToast(err.message || 'Erro ao baixar invoice', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="my-orders-page">
        <div className="page-loading">Carregando seus pedidos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-orders-page">
        <div className="page-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="my-orders-page">
      <div className="page-header">
        <h1>Meus Pedidos</h1>
        <p className="page-subtitle">Acompanhe toda a sua jornada como comprador</p>
      </div>

      {stats && (
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total de Pedidos</div>
              <div className="stat-value">{stats.totalOrders}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Valor Total</div>
              <div className="stat-value">{formatPrice(stats.totalValueCents, stats.currency)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Em Negociação</div>
              <div className="stat-value">{stats.ordersByStatus.negotiation || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Em Execução</div>
              <div className="stat-value">{stats.ordersByStatus.in_execution || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Concluídos</div>
              <div className="stat-value">{stats.ordersByStatus.completed || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Disputas Abertas</div>
              <div className="stat-value warning">{stats.openDisputes}</div>
            </div>
          </div>
        </div>
      )}

      <div className="filters-section">
        <div className="filters">
          <div className="filter-group">
            <label>Tipo:</label>
            <select
              value={filters.orderType || ''}
              onChange={(e) => setFilters({ ...filters, orderType: (e.target.value || undefined) as any })}
            >
              <option value="">Todos</option>
              <option value="rfq">RFQ</option>
              <option value="booking">Booking</option>
              <option value="service_order">Ordem de Serviço</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Período Início:</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
            />
          </div>
          <div className="filter-group">
            <label>Período Fim:</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
            />
          </div>
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={filters.hasOpenDispute || false}
                onChange={(e) => setFilters({ ...filters, hasOpenDispute: e.target.checked || undefined })}
              />
              Apenas com Disputa
            </label>
          </div>
        </div>
      </div>

      <div className="tabs-section">
        <div className="tabs">
          <button
            className={activeTab === 'all' ? 'tab-active' : ''}
            onClick={() => setActiveTab('all')}
          >
            Todos
          </button>
          <button
            className={activeTab === 'negotiation' ? 'tab-active' : ''}
            onClick={() => setActiveTab('negotiation')}
          >
            Em Negociação
          </button>
          <button
            className={activeTab === 'in_execution' ? 'tab-active' : ''}
            onClick={() => setActiveTab('in_execution')}
          >
            Em Execução
          </button>
          <button
            className={activeTab === 'completed' ? 'tab-active' : ''}
            onClick={() => setActiveTab('completed')}
          >
            Concluídos
          </button>
          <button
            className={activeTab === 'cancelled' ? 'tab-active' : ''}
            onClick={() => setActiveTab('cancelled')}
          >
            Cancelados
          </button>
          <button
            className={activeTab === 'disputed' ? 'tab-active' : ''}
            onClick={() => setActiveTab('disputed')}
          >
            Em Disputa
          </button>
        </div>
      </div>

      <div className="orders-section">
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.orderId} className="order-card">
                <div className="order-header">
                  <div className="order-title">
                    <h3>
                      {order.serviceName || order.eventName || 'Pedido'}
                      {order.eventName && (
                        <span className="event-badge">Evento</span>
                      )}
                    </h3>
                    <div className="order-meta">
                      <span className="order-type">{getOrderTypeLabel(order.orderType)}</span>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                  <div className="order-price">
                    {formatPrice(order.agreedPriceCents, order.currency)}
                  </div>
                </div>

                <div className="order-details">
                  <div className="detail-row">
                    <span className="detail-label">Criado em:</span>
                    <span>{new Date(order.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  {order.scheduledStart && (
                    <div className="detail-row">
                      <span className="detail-label">Agendado para:</span>
                      <span>{new Date(order.scheduledStart).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                  {order.completedAt && (
                    <div className="detail-row">
                      <span className="detail-label">Concluído em:</span>
                      <span>{new Date(order.completedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                {(order.hasOpenDispute || order.riskLevel) && (
                  <div className="order-alerts">
                    {order.hasOpenDispute && (
                      <div className="alert dispute-alert">
                        ⚠️ Disputa aberta
                      </div>
                    )}
                    {order.riskLevel && order.riskLevel !== 'low' && (
                      <div
                        className="alert risk-alert"
                        style={{ backgroundColor: getRiskLevelColor(order.riskLevel) }}
                      >
                        Risk Level: {order.riskLevel}
                      </div>
                    )}
                  </div>
                )}

                <div className="order-actions">
                  {order.threadId && (
                    <button
                      className="action-button chat"
                      onClick={() => handleViewChat(order.threadId)}
                    >
                      💬 Chat
                    </button>
                  )}
                  {order.agreementId && (
                    <button
                      className="action-button agreement"
                      onClick={() => handleViewAgreement(order.agreementId)}
                    >
                      📄 Acordo
                    </button>
                  )}
                  {order.evidencePackId && (
                    <button
                      className="action-button evidence"
                      onClick={() => handleViewEvidence(order.evidencePackId)}
                    >
                      📋 Evidence Pack
                    </button>
                  )}
                  {order.invoiceId && (
                    <button
                      className="action-button invoice"
                      onClick={() => handleDownloadInvoice(order.invoiceId)}
                    >
                      🧾 Download Invoice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




