// backend/src/modules/marketplace/purchase-order.repository.ts
// SPRINT 69: purchase_orders + purchase_order_items (colunas snake_case — migrations 0131)

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
  owner_actor_id: string;
  order_number: string | null;
  status: string;
  order_date: Date;
  expected_delivery_date: Date | null;
  received_at: Date | null;
  completed_at: Date | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zip_code: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  submitted_at: Date | null;
  submitted_by_actor_id: string | null;
  cancelled_at: Date | null;
  cancelled_by_actor_id: string | null;
  cancellation_reason: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface PurchaseOrderItemRow {
  id: string;
  tenant_id: string;
  purchase_order_id: string;
  product_variant_id: string;
  quantity_ordered: string;
  quantity_received: string;
  unit: string;
  unit_price_cents: string | null;
  currency: string;
  total_price_cents: string | null;
  notes: string | null;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PurchaseOrderRepository {
  private toPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      supplierId: row.supplier_id,
      ownerActorId: row.owner_actor_id,
      orderNumber: row.order_number,
      status: row.status as PurchaseOrder['status'],
      orderDate: row.order_date,
      expectedDeliveryDate: row.expected_delivery_date,
      receivedAt: row.received_at,
      completedAt: row.completed_at,
      deliveryAddress: row.delivery_address,
      deliveryCity: row.delivery_city,
      deliveryState: row.delivery_state,
      deliveryZipCode: row.delivery_zip_code,
      notes: row.notes,
      internalNotes: row.internal_notes,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      submittedAt: row.submitted_at,
      submittedByActorId: row.submitted_by_actor_id,
      cancelledAt: row.cancelled_at,
      cancelledByActorId: row.cancelled_by_actor_id,
      cancellationReason: row.cancellation_reason,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toPurchaseOrderItem(row: PurchaseOrderItemRow): PurchaseOrderItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      purchaseOrderId: row.purchase_order_id,
      productVariantId: row.product_variant_id,
      quantityOrdered: parseFloat(row.quantity_ordered),
      quantityReceived: parseFloat(row.quantity_received),
      unit: row.unit,
      unitPriceCents: row.unit_price_cents != null ? Number(row.unit_price_cents) : null,
      currency: row.currency,
      totalPriceCents: row.total_price_cents != null ? Number(row.total_price_cents) : null,
      notes: row.notes,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private poSelectList = `
      id, tenant_id, supplier_id, owner_actor_id, order_number, status,
      order_date, expected_delivery_date, received_at, completed_at,
      delivery_address, delivery_city, delivery_state, delivery_zip_code,
      notes, internal_notes,
      created_by_actor_id, created_by_user_id,
      submitted_at, submitted_by_actor_id,
      cancelled_at, cancelled_by_actor_id, cancellation_reason,
      metadata, created_at, updated_at`;

  private poItemSelectList = `
      id, tenant_id, purchase_order_id, product_variant_id,
      quantity_ordered, quantity_received, unit,
      unit_price_cents, currency, total_price_cents, notes,
      created_by_actor_id, created_by_user_id, metadata,
      created_at, updated_at`;

  async createPurchaseOrder(
    tenantId: string,
    input: {
      supplierId: string;
      ownerActorId: string;
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
        tenant_id, supplier_id, owner_actor_id, order_number, status,
        order_date, expected_delivery_date,
        delivery_address, delivery_city, delivery_state, delivery_zip_code,
        notes, internal_notes,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING ${this.poSelectList}
      `,
      [
        tenantId,
        input.supplierId,
        input.ownerActorId,
        input.orderNumber,
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

  async getPurchaseOrderById(tenantId: string, orderId: string): Promise<PurchaseOrder | null> {
    const rows = await runQueriesWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      SELECT ${this.poSelectList}
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
      SELECT ${this.poSelectList}
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
   * F-ERP-COMPOSED-VIEW (Fatia 8): lista PO's de UMA empresa (owner_actor_id), escopado em SQL —
   * evita o full-tenant-scan + pós-filtro que a rota `GET /purchase-orders` faz hoje
   * (`canRepresentActor` por linha). Autoridade sobre `ownerActorId` é responsabilidade do
   * CALLER (aqui, o actor-page em mode=operating já provou canRepresentActor na rota).
   */
  async listByOwner(tenantId: string, ownerActorId: string, options: { limit?: number } = {}): Promise<PurchaseOrder[]> {
    const rows = await runQueriesWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      SELECT ${this.poSelectList}
      FROM purchase_orders
      WHERE tenant_id = $1 AND owner_actor_id = $2
      ORDER BY order_date DESC
      LIMIT $3
      `,
      [tenantId, ownerActorId, options.limit ?? 10]
    );
    return rows.map((row) => this.toPurchaseOrder(row));
  }

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
      RETURNING ${this.poItemSelectList}
      `,
      [
        tenantId,
        orderId,
        input.productVariantId,
        input.quantityOrdered,
        0,
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

  async getItemsByOrderId(tenantId: string, orderId: string): Promise<PurchaseOrderItem[]> {
    const rows = await runQueriesWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      SELECT ${this.poItemSelectList}
      FROM purchase_order_items
      WHERE tenant_id = $1 AND purchase_order_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toPurchaseOrderItem(row));
  }

  async getItemById(tenantId: string, itemId: string): Promise<PurchaseOrderItem | null> {
    const rows = await runQueriesWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      SELECT ${this.poItemSelectList}
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

  async updateItemQuantityReceived(
    tenantId: string,
    itemId: string,
    quantityReceived: number
  ): Promise<PurchaseOrderItem> {
    const row = await runQueryWithTenant<PurchaseOrderItemRow>(
      tenantId,
      `
      UPDATE purchase_order_items
      SET quantity_received = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING ${this.poItemSelectList}
      `,
      [tenantId, itemId, quantityReceived]
    );

    if (!row) {
      throw new Error('Item não encontrado');
    }

    return this.toPurchaseOrderItem(row);
  }

  async submitOrder(
    tenantId: string,
    orderId: string,
    submittedByActorId: string
  ): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'submitted',
          submitted_at = NOW(),
          submitted_by_actor_id = $3,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'draft'
      RETURNING ${this.poSelectList}
      `,
      [tenantId, orderId, submittedByActorId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em DRAFT');
    }

    return this.toPurchaseOrder(row);
  }

  async markAsReceived(tenantId: string, orderId: string): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'received',
          received_at = COALESCE(received_at, NOW()),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
        AND status IN ('submitted', 'confirmed', 'partially_received', 'received')
      RETURNING ${this.poSelectList}
      `,
      [tenantId, orderId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não pode ser marcada como recebida');
    }

    return this.toPurchaseOrder(row);
  }

  async markAsCompleted(tenantId: string, orderId: string): Promise<PurchaseOrder> {
    const row = await runQueryWithTenant<PurchaseOrderRow>(
      tenantId,
      `
      UPDATE purchase_orders
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'received'
      RETURNING ${this.poSelectList}
      `,
      [tenantId, orderId]
    );

    if (!row) {
      throw new Error('Ordem não encontrada ou não está em RECEIVED');
    }

    return this.toPurchaseOrder(row);
  }

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
          cancelled_at = NOW(),
          cancelled_by_actor_id = $3,
          cancellation_reason = $4,
          updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
        AND status IN ('draft', 'submitted', 'confirmed')
      RETURNING ${this.poSelectList}
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
