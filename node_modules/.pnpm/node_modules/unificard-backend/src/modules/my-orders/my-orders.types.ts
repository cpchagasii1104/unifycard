// backend/src/modules/my-orders/my-orders.types.ts
// My Orders & Purchases Hub - Tipos
// 🔴 BLINDAGEM: Apenas agregações read-only, nenhuma mutação
// 🔴 BLINDAGEM: Backend é única fonte de verdade

/**
 * Tipo de pedido/ordem
 */
export type OrderType = 'rfq' | 'booking' | 'service_order' | 'agreement' | 'bundle';

/**
 * Status consolidado do pedido
 */
export type OrderStatus =
  | 'negotiation' // Em negociação (RFQ aberto, Agreement DRAFT/PROPOSED)
  | 'agreement_finalized' // Acordo finalizado, aguardando execução
  | 'in_execution' // Em execução (ServiceOrder IN_PROGRESS)
  | 'completed' // Concluído (ServiceOrder COMPLETED)
  | 'cancelled' // Cancelado
  | 'disputed'; // Em disputa

/**
 * Item unificado do My Orders Hub
 */
export interface MyOrderItem {
  orderId: string; // ID único do item (pode ser bookingId, serviceOrderId, rfqId, etc)
  orderType: OrderType;
  status: OrderStatus;
  
  // Informações do serviço/evento
  serviceId: string | null;
  serviceName: string | null;
  eventId: string | null;
  eventName: string | null;
  
  // Informações financeiras
  agreedPriceCents: number | null; // Valor acordado (do Agreement se FINALIZED)
  currency: string;
  
  // Datas
  createdAt: string;
  updatedAt: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  completedAt: Date | null;
  
  // Links para outras entidades
  bookingId: string | null;
  serviceOrderId: string | null;
  rfqId: string | null;
  agreementId: string | null;
  threadId: string | null; // Chat contextual
  evidencePackId: string | null;
  invoiceId: string | null;
  
  // Indicadores de risco/trust
  hasOpenDispute: boolean;
  trustScore: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' | null;
  
  // Metadados
  metadata: Record<string, any>;
}

/**
 * Filtros para buscar pedidos
 */
export interface MyOrdersFilters {
  orderType?: OrderType;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
  hasOpenDispute?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Estatísticas do My Orders Hub
 */
export interface MyOrdersStats {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByType: Record<OrderType, number>;
  totalValueCents: number;
  currency: string;
  openDisputes: number;
}





