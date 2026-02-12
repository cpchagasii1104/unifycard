// backend/src/modules/marketplace/order.types.ts
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// Tipos para pedidos e itens

/**
 * Status do pedido
 */
export type OrderStatus = 'draft' | 'submitted' | 'cancelled' | 'expired';

/**
 * Pedido
 * Representa intenção estruturada, não execução
 */
export interface Order {
  id: string;
  tenantId: string;
  buyerActorId: string;
  sellerActorId: string;
  status: OrderStatus;
  totalQuantity: number;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar pedido
 */
export interface CreateOrderInput {
  buyerActorId: string;
  sellerActorId: string;
  status?: OrderStatus;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar pedido
 */
export interface UpdateOrderInput {
  status?: OrderStatus;
  metadata?: Record<string, any>;
}

/**
 * Opções de busca de pedidos
 */
export interface ListOrdersOptions {
  buyerActorId?: string;
  sellerActorId?: string;
  status?: OrderStatus;
  // SPRINT 52: Paginação padronizada
  limit?: number;
  offset?: number;
  cursor?: string; // Para paginação cursor-based
}

/**
 * Item de pedido
 */
export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  unit: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para adicionar item ao pedido
 */
export interface AddOrderItemInput {
  productVariantId: string;
  quantity: number;
  unit?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar item do pedido
 */
export interface UpdateOrderItemInput {
  quantity?: number;
  unit?: string;
  metadata?: Record<string, any>;
}

/**
 * Histórico de mudança de status
 * Append-only, auditável
 */
export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByUserId?: string | null;
  reason?: string | null;
  createdAt: string;
}

/**
 * Input para mudar status do pedido
 */
export interface ChangeOrderStatusInput {
  toStatus: OrderStatus;
  reason?: string;
  changedByUserId?: string;
}


