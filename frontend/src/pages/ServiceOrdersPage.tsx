// src/pages/ServiceOrdersPage.tsx
// Lista de Service Orders
// SPRINT 68: Service Orders + Agenda

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { listServiceOrders, type ServiceOrder, type ServiceOrderStatus } from '../api/service-orders';
import { showToast } from '../components/common/Toast';
import { getServiceName, getActorName, formatEntityDisplay } from '../utils/service-orders-helpers';
import './ServiceOrdersPage.css';

export default function ServiceOrdersPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ajuste UX: Filtro padrão DRAFT para funcionários
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | 'ALL'>(
    activeActor?.actor_type === 'page' ? 'DRAFT' : 'ALL'
  );
  const [entityNames, setEntityNames] = useState<Record<string, { service?: string | null; worker?: string | null; customer?: string | null }>>({});
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    loadOrders();
  }, [activeActor, statusFilter]);

  // Carregar nomes de serviços e atores
  useEffect(() => {
    if (orders.length > 0) {
      loadEntityNames();
    }
  }, [orders]);

  // Contar ordens pendentes (apenas para funcionários)
  useEffect(() => {
    if (activeActor?.actor_type === 'page' && !isLoading) {
      countPendingOrders();
    } else {
      setPendingCount(0);
    }
  }, [activeActor?.actor_id, activeActor?.actor_type, isLoading]);

  const loadOrders = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      
      // Filtrar por actor ativo (cliente ou funcionário)
      if (activeActor.actor_type === 'user') {
        filters.customerActorId = activeActor.actor_id;
      } else if (activeActor.actor_type === 'page') {
        filters.workerActorId = activeActor.actor_id;
      }

      if (statusFilter !== 'ALL') {
        filters.status = statusFilter;
      }

      const data = await listServiceOrders(filters);
      setOrders(data);
    } catch (err) {
      console.error('[ServiceOrders] erro ao carregar ordens:', err);
      const message = err instanceof Error ? err.message : 'Não foi possível carregar as ordens. Tente novamente.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEntityNames = async () => {
    const names: Record<string, { service?: string | null; worker?: string | null; customer?: string | null }> = {};
    
    for (const order of orders) {
      if (!names[order.id]) {
        names[order.id] = {};
      }
      
      // Buscar nomes em paralelo
      const [serviceName, workerName, customerName] = await Promise.all([
        getServiceName(order.serviceId),
        getActorName(order.workerActorId),
        getActorName(order.customerActorId),
      ]);
      
      names[order.id] = {
        service: serviceName,
        worker: workerName,
        customer: customerName,
      };
    }
    
    setEntityNames(names);
  };

  const countPendingOrders = async () => {
    if (!activeActor || activeActor.actor_type !== 'page') return;
    
    try {
      const filters: any = { workerActorId: activeActor.actor_id, status: 'DRAFT' };
      const pending = await listServiceOrders(filters);
      setPendingCount(pending.length);
    } catch {
      // Ignorar erro no contador (não quebra o fluxo)
      setPendingCount(0);
    }
  };

  const getStatusBadgeClass = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'CONFIRMED': return 'status-confirmed';
      case 'IN_PROGRESS': return 'status-in-progress';
      case 'COMPLETED': return 'status-completed';
      case 'CANCELLED': return 'status-cancelled';
      default: return 'status-default';
    }
  };

  const getStatusLabel = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'DRAFT': return 'Rascunho';
      case 'CONFIRMED': return 'Confirmada';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluída';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="service-orders-page">
        <div className="loading">Carregando ordens...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="service-orders-page">
        <div className="error">{error}</div>
        <button onClick={loadOrders}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="service-orders-page">
      <div className="page-header">
        <div>
          <h1>Ordens de Serviço</h1>
          {activeActor && (
            <p className="acting-as">
              Operando como: <strong>{activeActor.display_name}</strong>
            </p>
          )}
          {activeActor?.actor_type === 'page' && pendingCount > 0 && (
            <span className="pending-badge">
              {pendingCount} {pendingCount === 1 ? 'ordem pendente' : 'ordens pendentes'}
            </span>
          )}
        </div>
        {/* F-MVP-SERVICE-CHAIN-UX-DEAD-END-SWEEP (2026-06-26): a ordem nasce só pelo fluxo canônico
            (reserva → aceite). CTA legado "Nova Ordem" (criação direta) REMOVIDO; aqui só atalhos
            canônicos por persona. Prestador opera pela Central; cliente reserva pela descoberta. */}
        <div className="header-actions">
          {activeActor?.actor_type === 'page' ? (
            <>
              <button
                className="btn-primary"
                onClick={() => navigate('/services')}
              >
                Central do prestador
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate('/services/new')}
              >
                Publicar serviço
              </button>
            </>
          ) : (
            <button
              className="btn-primary"
              onClick={() => navigate('/discover/services')}
            >
              Explorar serviços
            </button>
          )}
          {/* F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (GAP-C): esta tela mostra as ordens em que o
              actor ativo é PARTE (cliente/prestador). Quem recebeu service_order:view de OUTRO
              prestador vê aquelas ordens na tela de operador (read-only, por concessão). */}
          <button
            className="btn-secondary"
            onClick={() => navigate('/operator/service-orders')}
          >
            Ordens por concessão
          </button>
        </div>
      </div>

      <div className="filters">
        <label>Filtrar por status:</label>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value as ServiceOrderStatus | 'ALL')}
        >
          <option value="ALL">Todas</option>
          <option value="DRAFT">Rascunho</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="IN_PROGRESS">Em Andamento</option>
          <option value="COMPLETED">Concluídas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma ordem encontrada.</p>
          {activeActor?.actor_type === 'page' ? (
            <button className="btn-secondary" onClick={() => navigate('/services')}>
              Ir para a Central do prestador
            </button>
          ) : (
            <button className="btn-secondary" onClick={() => navigate('/discover/services')}>
              Explorar serviços
            </button>
          )}
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div 
              key={order.id} 
              className="order-card"
              onClick={() => navigate(`/service-orders/${order.id}`)}
            >
              <div className="order-header">
                <h3>Ordem #{order.id.substring(0, 8)}</h3>
                <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </div>
              
              <div className="order-info">
                <p>
                  <strong>Serviço:</strong> {
                    entityNames[order.id]?.service 
                      ? formatEntityDisplay(order.serviceId, entityNames[order.id].service)
                      : `${order.serviceId.substring(0, 8)}...`
                  }
                </p>
                {activeActor?.actor_type === 'user' && (
                  <p>
                    <strong>Funcionário:</strong> {
                      entityNames[order.id]?.worker
                        ? formatEntityDisplay(order.workerActorId, entityNames[order.id].worker)
                        : `${order.workerActorId.substring(0, 8)}...`
                    }
                  </p>
                )}
                {activeActor?.actor_type === 'page' && (
                  <p>
                    <strong>Cliente:</strong> {
                      entityNames[order.id]?.customer
                        ? formatEntityDisplay(order.customerActorId, entityNames[order.id].customer)
                        : `${order.customerActorId.substring(0, 8)}...`
                    }
                  </p>
                )}
                <p><strong>Agendado para:</strong> {formatDate(order.scheduledStart)}</p>
                {order.locationAddress && (
                  <p><strong>Local:</strong> {order.locationAddress}</p>
                )}
                {order.description && (
                  <p><strong>Descrição:</strong> {order.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

