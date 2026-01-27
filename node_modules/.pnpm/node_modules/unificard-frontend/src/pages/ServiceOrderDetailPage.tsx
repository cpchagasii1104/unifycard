// src/pages/ServiceOrderDetailPage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Detail Page
// Visualização focada em UMA ordem de serviço (read-only)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  getServiceOrder,
  type ServiceOrder,
} from '../api/service-orders';
import { getServiceName, getActorName, formatEntityDisplay } from '../utils/service-orders-helpers';
import './ServiceOrderDetailPage.css';

export default function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityNames, setEntityNames] = useState<{ service?: string | null; worker?: string | null; customer?: string | null }>({});

  useEffect(() => {
    if (id) {
      loadOrder();
    }
  }, [id]);

  const loadOrder = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getServiceOrder(id);
      setOrder(data);
      
      // Carregar nomes
      if (data) {
        loadEntityNames(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar ordem';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEntityNames = async (orderData: ServiceOrder) => {
    const [serviceName, workerName, customerName] = await Promise.all([
      getServiceName(orderData.serviceId),
      getActorName(orderData.workerActorId),
      getActorName(orderData.customerActorId),
    ]);
    
    setEntityNames({
      service: serviceName,
      worker: workerName,
      customer: customerName,
    });
  };

  // 🔴 ENTITY DETAIL PAGE: CTAs explícitos para navegar para Action Pages dedicadas
  const handleNavigateToAction = (action: 'confirm' | 'start' | 'complete' | 'cancel') => {
    if (!order) return;
    navigate(`/service-orders/${order.id}/${action}`);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não informado';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Rascunho';
      case 'CONFIRMED': return 'Confirmada';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluída';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  // 🔴 ENTITY DETAIL PAGE: Verificações apenas para exibir CTAs (não executar ações)
  const canConfirm = order?.status === 'DRAFT' && activeActor?.actor_id === order.workerActorId;
  const canStart = order?.status === 'CONFIRMED' && activeActor?.actor_id === order.workerActorId;
  const canComplete = order?.status === 'IN_PROGRESS' && activeActor?.actor_id === order.workerActorId;
  const canCancel = order && ['DRAFT', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status);

  if (isLoading) {
    return (
      <div className="service-order-detail-page">
        <div className="loading">Carregando ordem...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="service-order-detail-page">
        <div className="error">{error || 'Ordem não encontrada'}</div>
        <button onClick={() => navigate('/service-orders')}>Voltar</button>
      </div>
    );
  }

  return (
    <div className="service-order-detail-page">
      <div className="page-header">
        <button onClick={() => navigate('/service-orders')}>← Voltar</button>
        <h1>Ordem de Serviço #{order.id.substring(0, 8)}</h1>
      </div>

      <div className="order-detail">
        <div className="detail-section">
          <h2>Status</h2>
          <p className="status">{getStatusLabel(order.status)}</p>
        </div>

        <div className="detail-section">
          <h2>Informações</h2>
          <p>
            <strong>Serviço:</strong> {
              entityNames.service
                ? formatEntityDisplay(order.serviceId, entityNames.service)
                : order.serviceId
            }
          </p>
          <p>
            <strong>Funcionário:</strong> {
              entityNames.worker
                ? formatEntityDisplay(order.workerActorId, entityNames.worker)
                : `${order.workerActorId.substring(0, 8)}...`
            }
          </p>
          <p>
            <strong>Cliente:</strong> {
              entityNames.customer
                ? formatEntityDisplay(order.customerActorId, entityNames.customer)
                : `${order.customerActorId.substring(0, 8)}...`
            }
          </p>
          <p><strong>Agendado para:</strong> {formatDate(order.scheduledStart)}</p>
          {order.scheduledEnd && (
            <p><strong>Até:</strong> {formatDate(order.scheduledEnd)}</p>
          )}
          {order.estimatedDurationMinutes && (
            <p><strong>Duração estimada:</strong> {order.estimatedDurationMinutes} minutos</p>
          )}
        </div>

        {order.locationAddress && (
          <div className="detail-section">
            <h2>Localização</h2>
            <p>{order.locationAddress}</p>
            {order.locationLatitude && order.locationLongitude && (
              <p>
                Coordenadas: {order.locationLatitude.toFixed(6)}, {order.locationLongitude.toFixed(6)}
              </p>
            )}
          </div>
        )}

        {order.description && (
          <div className="detail-section">
            <h2>Descrição</h2>
            <p>{order.description}</p>
          </div>
        )}

        {order.customerNotes && (
          <div className="detail-section">
            <h2>Notas do Cliente</h2>
            <p>{order.customerNotes}</p>
          </div>
        )}

        {order.workerNotes && (
          <div className="detail-section">
            <h2>Notas do Funcionário</h2>
            <p>{order.workerNotes}</p>
          </div>
        )}

        <div className="detail-section">
          <h2>Histórico</h2>
          {order.confirmedAt && (
            <p><strong>Confirmada em:</strong> {formatDate(order.confirmedAt)}</p>
          )}
          {order.startedAt && (
            <p><strong>Iniciada em:</strong> {formatDate(order.startedAt)}</p>
          )}
          {order.completedAt && (
            <p><strong>Concluída em:</strong> {formatDate(order.completedAt)}</p>
          )}
          {order.cancelledAt && (
            <p><strong>Cancelada em:</strong> {formatDate(order.cancelledAt)}</p>
          )}
          {order.cancellationReason && (
            <p><strong>Motivo do cancelamento:</strong> {order.cancellationReason}</p>
          )}
        </div>
      </div>

      {/* 🔴 ENTITY DETAIL PAGE: CTAs explícitos para navegar para Action Pages dedicadas */}
      <div className="actions">
        {canConfirm && (
          <button 
            className="btn-primary"
            onClick={() => handleNavigateToAction('confirm')}
          >
            Confirmar Ordem
          </button>
        )}
        {canStart && (
          <button 
            className="btn-primary"
            onClick={() => handleNavigateToAction('start')}
          >
            Iniciar Serviço
          </button>
        )}
        {canComplete && (
          <button 
            className="btn-primary"
            onClick={() => handleNavigateToAction('complete')}
          >
            Completar Serviço
          </button>
        )}
        {canCancel && (
          <button 
            className="btn-danger"
            onClick={() => handleNavigateToAction('cancel')}
          >
            Cancelar Ordem
          </button>
        )}
      </div>
    </div>
  );
}

