// backend/src/modules/marketplace/purchase-order.repository.ts
// SPRINT 69: Repository para purchase_orders e purchase_order_items

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderFilters,
} from './purchase-order.types';

interface PurchaseOrderRow {
  id: string;
  tenant_id: string;
  supplier_id: string;
  order_number: string | null;
  status: string;
  order_date: Date;
  expected_delivery_date: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zip_code: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  submittedAt: Date | null;
  submitted_by_actor_id: string | null;
  cancelledAt: Date | null;
  cancelled_by_actor_id: string | null;
  cancellation_reason: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

interface PurchaseOrderItemRow {
  id: string;
  tenant_id: string;
  purchase_order_id: string;
  product_variant_id: string;
  quantity_ordered: string;
  quantity_received: string;
  unit: string;
  unit_price_cents: number | null;
  currency: string;
  total_price_cents: number | null;
  notes: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class PurchaseOrderRepository {
  /**
   * Converte row para PurchaseOrder
   */
  private toPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      supplierId: row.supplier_id,
      orderNumber: row.order_number,
      status: row.status as any,
      orderDate: row.order_date,
      expectedDeliveryDate: row.expected_delivery_date,
      receivedAt: row.receivedAt,
      completedAt: row.completedAt,
      deliveryAddress: row.delivery_address,
      deliveryCity: row.delivery_city,
      deliveryState: row.delivery_state,
      deliveryZipCode: row.delivery_zip_code,
      notes: row.notes,
      internalNotes: row.internal_notes,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      submittedAt: row.submittedAt,
      submittedByActorId: row.submitted_by_actor_id,
      cancelledAt: row.cancelledAt,
      cancelledByActorId: row.cancelled_by_actor_id,
      cancellationReason: row.cancellation_reason,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Converte row para PurchaseOrderItem
   */
  private toPurchaseOrderItem(row: PurchaseOrderItemRow): PurchaseOrderItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      purchaseOrderId: row.purchase_order_id,
      productVariantId: row.product_variant_id,
      quantityOrdered: parseFloat(row.quantity_ordered),
      quantityReceived: parseFloat(row.quantity_received),
      unit: row.unit,
      unitPriceCents: row.unit_price_cents,
      currency: row.currency,
      totalPriceCents: row.total_price_cents,
      notes: row.notes,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria ordem de compra
   */
  async createPurchaseOrder(
    tenantId: string,
    input: {
      supplierId: string;
      orderNumber: string | null;
      orderDate: Date;
      expectedDeliveryDate: Date | null;
      deliveryAddress: string | null;
      deliveryCity: string | null;
      deliveryState: string | null;
      deliveryZipCode: string | null;
      notes: string | null;
      internalNotes: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      INSERT INTO purchase_orders (
        tenant_id, supplier_id, order_number, status,
        order_date, expected_delivery_date,
        delivery_address, delivery_city, delivery_state, delivery_zip_code,
        notes, internal_notes,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING id, tenant_id, supplier_id, order_number, status,
                order_date, expected_delivery_date, receivedAt, completedAt,
                delivery_address, delivery_city, delivery_state, delivery_zip_code,
                notes, internal_notes,
                created_by_actor_id, created_by_user_id,
                submittedAt, submitted_by_actor_id,
                cancelledAt, cancelled_by_actor_id, cancellation_reason,
                metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.supplierId,
        input.orderNumber,
        'draft',
        input.orderDate,
        input.expectedDeliveryDate,
        input.deliveryAddress,
        input.deliveryCity,
        input.deliveryState,
        input.deliveryZipCode,
        input.notes,
        input.internalNotes,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar ordem de compra');
    }

    return this.toPurchaseOrder(row);
  }

  /**
   * Busca ordem por ID
   */
  async getPurchaseOrderById(tenantId: string, orderId: string): Promise<PurchaseOrder | null> {
    const rows = await runQueriesWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, supplier_id, order_number, status,
             order_date, expected_delivery_date, receivedAt, completedAt,
             delivery_address, delivery_city, delivery_state, delivery_zip_code,
             notes, internal_notes,
             created_by_actor_id, created_by_user_id,
             submittedAt, submitted_by_actor_id,
             cancelledAt, cancelled_by_actor_id, cancellation_reason,
             metadata, createdAt, updatedAt
      FROM purchase_orders
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, orderId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toPurchaseOrder(rows[0]);
  }

  /**
   * Lista ordens com filtros
   */
  async listPurchaseOrders(tenantId: string, filters: PurchaseOrderFilters = {}): Promise<PurchaseOrder[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.supplierId) {
      conditions.push(`supplier_id = $${paramIndex}`);
      params.push(filters.supplierId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.orderDateFrom) {
      const dateFrom = filters.orderDateFrom instanceof Date ? filters.orderDateFrom : new Date(filters.orderDateFrom);
      conditions.push(`order_date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (filters.orderDateTo) {
      const dateTo = filters.orderDateTo instanceof Date ? filters.orderDateTo : new Date(filters.orderDateTo);
      conditions.push(`order_date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, supplier_id, order_number, status,
             order_date, expected_delivery_date, receivedAt, completedAt,
             delivery_address, delivery_city, delivery_state, delivery_zip_code,
             notes, internal_notes,
             created_by_actor_id, created_by_user_id,
             submittedAt, submitted_by_actor_id,
             cancelledAt, cancelled_by_actor_id, cancellation_reason,
             metadata, createdAt, updatedAt
      FROM purchase_orders
      WHERE ${conditions.join(' AND ')}
      ORDER BY order_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toPurchaseOrder(row));
  }

  /**
   * Adiciona item à ordem
   */
  async addItem(
    tenantId: string,
    orderId: string,
    input: {
      productVariantId: string;
      quantityOrdered: number;
      unit: string;
      unitPriceCents: number | null;
      currency: string;
      totalPriceCents: number | null;
      notes: string | null;
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<PurchaseOrderItem> {
    const row = await runQueryWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      INSERT INTO purchase_order_items (
        tenant_id, purchase_order_id, product_variant_id,
        quantity_ordered, quantity_received, unit,
        unit_price_cents, currency, total_price_cents, notes,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      RETURNING id, tenant_id, purchase_order_id, product_variant_id,
                quantity_ordered, quantity_received, unit,
                unit_price_cents, currency, total_price_cents, notes,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [
        tenantId,
        orderId,
        input.productVariantId,
        input.quantityOrdered,
        0, // quantity_received inicia em 0
        input.unit,
        input.unitPriceCents,
        input.currency,
        input.totalPriceCents,
        input.notes,
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao adicionar item à ordem');
    }

    return this.toPurchaseOrderItem(row);
  }

  /**
   * Busca itens de uma ordem
   */
  async getItemsByOrderId(tenantId: string, orderId: string): Promise<PurchaseOrderItem[]> {
    const rows = await runQueriesWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, purchase_order_id, product_variant_id,
             quantity_ordered, quantity_received, unit,
             unit_price_cents, currency, total_price_cents, notes,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM purchase_order_items
      WHERE tenant_id = $1 AND purchase_order_id = $2
      ORDER BY createdAt ASC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toPurchaseOrderItem(row));
  }

  /**
   * Busca item por ID
   */
  async getItemById(tenantId: string, itemId: string): Promise<PurchaseOrderItem | null> {
    const rows = await runQueriesWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, purchase_order_id, product_variant_id,
             quantity_ordered, quantity_received, unit,
             unit_price_cents, currency, total_price_cents, notes,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM purchase_order_items
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, itemId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toPurchaseOrderItem(rows[0]);
  }

  /**
   * Atualiza quantidade recebida de um item
   */
  async updateItemQuantityReceived(
    tenantId: string,
    itemId: string,
    quantityReceived: number
  ): Promise<PurchaseOrderItem> {
    const row = await runQueryWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      UPDATE purchase_order_items
      SET quantity_received = $3, updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, purchase_order_id, product_variant_id,
                quantity_ordered, quantity_received, unit,
                unit_price_cents, currency, total_price_cents, notes,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
      `,
      [tenantId, itemId, quantityReceived]
    );

    if (!row) {
      throw new Error('Item não encontrado');
    }

    return this.toPurchaseOrderItem(row);
  }

  /**
   * Atualiza status para SUBMITTED
   */
  async submitOrder(
    tenantId: string,
    orderId: string,
    submittedByActorId: string
  ): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'SUBMITTED',
          submittedAt = NOW(),
          submitted_by_actor_id = $3,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'draft'
      RETURNING id, tenant_id, supplier_id, order_number, status,
                order_date, expected_delivery_date, receivedAt, completedAt,
                delivery_address, delivery_city, delivery_state, delivery_zip_code,
                notes, internal_notes,
                created_by_actor_id, created_by_user_id,
                submittedAt, submitted_by_actor_id,
                cancelledAt, cancelled_by_actor_id, cancellation_reason,
                metadata, createdAt, updatedAt
      `,
      [tenantId, orderId, submittedByActorId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em DRAFT');
    }

    return this.toPurchaseOrder(row);
  }

  /**
   * Atualiza status para RECEIVED
   */
  async markAsReceived(tenantId: string, orderId: string): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'RECEIVED',
          receivedAt = COALESCE(receivedAt, NOW()),
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status IN ('SUBMITTED', 'RECEIVED')
      RETURNING id, tenant_id, supplier_id, order_number, status,
                order_date, expected_delivery_date, receivedAt, completedAt,
                delivery_address, delivery_city, delivery_state, delivery_zip_code,
                notes, internal_notes,
                created_by_actor_id, created_by_user_id,
                submittedAt, submitted_by_actor_id,
                cancelledAt, cancelled_by_actor_id, cancellation_reason,
                metadata, createdAt, updatedAt
      `,
      [tenantId, orderId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não pode ser marcada como recebida');
    }

    return this.toPurchaseOrder(row);
  }

  /**
   * Atualiza status para COMPLETED
   */
  async markAsCompleted(tenantId: string, orderId: string): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'completed',
          completedAt = NOW(),
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'RECEIVED'
      RETURNING id, tenant_id, supplier_id, order_number, status,
                order_date, expected_delivery_date, receivedAt, completedAt,
                delivery_address, delivery_city, delivery_state, delivery_zip_code,
                notes, internal_notes,
                created_by_actor_id, created_by_user_id,
                submittedAt, submitted_by_actor_id,
                cancelledAt, cancelled_by_actor_id, cancellation_reason,
                metadata, createdAt, updatedAt
      `,
      [tenantId, orderId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em RECEIVED');
    }

    return this.toPurchaseOrder(row);
  }

  /**
   * Atualiza status para CANCELLED
   */
  async cancelOrder(
    tenantId: string,
    orderId: string,
    cancelledByActorId: string,
    cancellationReason: string | null
  ): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'cancelled',
          cancelledAt = NOW(),
          cancelled_by_actor_id = $3,
          cancellation_reason = $4,
          updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status IN ('draft', 'submitted')
      RETURNING id, tenant_id, supplier_id, order_number, status,
                order_date, expected_delivery_date, receivedAt, completedAt,
                delivery_address, delivery_city, delivery_state, delivery_zip_code,
                notes, internal_notes,
                created_by_actor_id, created_by_user_id,
                submittedAt, submitted_by_actor_id,
                cancelledAt, cancelled_by_actor_id, cancellation_reason,
                metadata, createdAt, updatedAt
      `,
      [tenantId, orderId, cancelledByActorId, cancellationReason]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não pode ser cancelada');
    }

    return this.toPurchaseOrder(row);
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();








