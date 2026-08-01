// backend/src/modules/marketplace/purchase-order.types.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

/**
 * Status da ordem de compra
 */
/**
 * Alinhado a purchase_order_status (criado em 0131; case convergido para a norma em
 * 20260801120000). Minúsculo snake_case por 07_NOMENCLATURA §4.11 — não renomear de um lado só.
 */
export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'partially_received'
  | 'received'
  | 'cancelled'
  | 'completed';

/**
 * Ordem de Compra
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Purchase Order NÃO é Order (marketplace)
 * - NÃO executa pagamentos
 * - NÃO emite fiscal
 * - Inventory entra apenas no RECEIVE
 */
export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  /** Owner empresarial material (actor operacional da empresa COMPRADORA = page+company_id). Autoridade. */
  ownerActorId: string;
  orderNumber: string | null;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryZipCode: string | null;
  notes: string | null;
  internalNotes: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  submittedAt: Date | null;
  submittedByActorId: string | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancellationReason: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Item de Ordem de Compra
 */
export interface PurchaseOrderItem {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  productVariantId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  unitPriceCents: number | null;
  currency: string;
  totalPriceCents: number | null;
  notes: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar ordem de compra
 */
export interface CreatePurchaseOrderInput {
  supplierId: string;
  /** Owner empresarial DERIVADO/validado server-side (page+company_id representável). Body = só HINT. */
  ownerActorId?: string;
  orderNumber?: string;
  orderDate?: Date | string;
  expectedDeliveryDate?: Date | string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryZipCode?: string;
  notes?: string;
  internalNotes?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para adicionar item à ordem
 */
export interface AddPurchaseOrderItemInput {
  productVariantId: string;
  quantityOrdered: number;
  unit?: string;
  unitPriceCents?: number;
  currency?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para receber item
 */
export interface ReceivePurchaseOrderItemInput {
  itemId: string;
  quantityReceived: number;
  notes?: string;
}

/**
 * Input para receber ordem completa
 */
export interface ReceivePurchaseOrderInput {
  items: Array<{
    itemId: string;
    quantityReceived: number;
    notes?: string;
  }>;
  notes?: string;
}

/**
 * Filtros para listar ordens de compra
 */
export interface PurchaseOrderFilters {
  supplierId?: string;
  status?: PurchaseOrderStatus;
  orderDateFrom?: Date | string;
  orderDateTo?: Date | string;
  limit?: number;
  offset?: number;
}







