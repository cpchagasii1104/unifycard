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
  // Ajuste UX: Filtro padrão draft para funcionários
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | 'ALL'>(
    activeActor?.actor_type === 'page' ? 'draft' : 'ALL'
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
      const filters: any = { workerActorId: activeActor.actor_id, status: 'draft' };
      const pending = await listServiceOrders(filters);
      setPendingCount(pending.length);
    } catch {
      // Ignorar erro no contador (não quebra o fluxo)
      setPendingCount(0);
    }
  };

  const getStatusBadgeClass = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'draft': return 'status-draft';
      case 'confirmed': return 'status-confirmed';
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      case 'seller_pending': return 'status-seller-pending';
      case 'release_approved': return 'status-release-approved';
      case 'funds_released': return 'status-funds-released';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-default';
    }
  };

  // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
  // ║ STATUS:  CANÔNICO
  // ║ NORMA:   backend/src/modules/services/service-order.types.ts:4-36 (comentário de cada
  // ║          estado do ciclo de liberação de escrow) + decisão de rótulo de Clayton, 2026-07-31
  // ║ NÃO:     "Fundos Liberados"/"Pagamento Recebido"/"Pago" para funds_released — sugere
  // ║          dinheiro disponível pra saque; funds_released só move pra actor_wallet INTERNA,
  // ║          saque é pedido+aprovação à parte (payout-request.routes.ts é REQUEST-ONLY).
  // ║          NÃO usar "Liberada"/particípio de liberar em release_approved — a norma diz que
  // ║          é aprovação para FUTURA liberação, NÃO fundos liberados; misturar destrói a
  // ║          distinção que a própria migration/tipo existe pra preservar.
  // ║ EM VEZ:  os 3 rótulos abaixo, decisão explícita de Clayton (não inventados pela IA).
  // ╚════════════════════════════════════════════════════════════════
  const getStatusLabel = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'draft': return 'Rascunho';
      case 'confirmed': return 'Confirmada';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluída';
      case 'seller_pending': return 'Aguardando Confirmação do Comprador';
      case 'release_approved': return 'Aprovada para Liberação';
      case 'funds_released': return 'Liberado para a Carteira';
      case 'cancelled': return 'Cancelada';
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
        {/* DT-UX-BACK-BUTTON-COVERAGE (#9): tela de erro também tem saída segura, não history do navegador. */}
        <button className="btn-back" onClick={() => navigate('/services')}>← Voltar</button>
        <div className="error">{error}</div>
        <button onClick={loadOrders}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="service-orders-page">
      {/* DT-UX-BACK-BUTTON-COVERAGE (#9): /service-orders era tela-folha sem volta. Rota segura = /services. */}
      <button className="btn-back" onClick={() => navigate('/services')}>← Voltar</button>
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
          <option value="draft">Rascunho</option>
          <option value="confirmed">Confirmadas</option>
          <option value="in_progress">Em Andamento</option>
          <option value="completed">Concluídas</option>
          <option value="seller_pending">Aguardando Confirmação do Comprador</option>
          <option value="release_approved">Aprovadas para Liberação</option>
          <option value="funds_released">Liberadas para a Carteira</option>
          <option value="cancelled">Canceladas</option>
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

