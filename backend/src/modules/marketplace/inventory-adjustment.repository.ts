// backend/src/modules/marketplace/inventory-adjustment.repository.ts
// SPRINT 57: Repository para ajustes de estoque

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  InventoryAdjustment,
  CreateInventoryAdjustmentInput,
  ListInventoryAdjustmentsOptions,
} from './inventory-adjustment.types';

interface InventoryAdjustmentRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  product_variant_id: string;
  inventory_lot_id: string | null;
  adjustment_type: string;
  quantity: string;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  created_by_user_id: string;
  metadata: any;
  created_at: Date;
}

class InventoryAdjustmentRepository {
  /**
   * Converte row para InventoryAdjustment
   */
  private toAdjustment(row: InventoryAdjustmentRow): InventoryAdjustment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      productVariantId: row.product_variant_id,
      inventoryLotId: row.inventory_lot_id,
      adjustmentType: row.adjustment_type as any,
      quantity: parseFloat(row.quantity),
      reason: row.reason,
      referenceType: row.reference_type as any,
      referenceId: row.reference_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria ajuste
   */
  async createAdjustment(
    tenantId: string,
    input: CreateInventoryAdjustmentInput,
    createdByUserId: string
  ): Promise<InventoryAdjustment> {
    // Validar quantidade baseado no tipo
    if (input.adjustmentType === 'LOSS' || input.adjustmentType === 'DAMAGE') {
      if (input.quantity >= 0) {
        throw new Error(
          `Ajuste do tipo ${input.adjustmentType} deve ter quantidade negativa`
        );
      }
    } else if (input.adjustmentType === 'SURPLUS') {
      if (input.quantity <= 0) {
        throw new Error('Ajuste do tipo SURPLUS deve ter quantidade positiva');
      }
    }

    const row = await runQueryWithTenant<InventoryAdjustmentRow>(
      tenantId,
      `
      INSERT INTO inventory_adjustments (
        tenant_id, actor_id, product_variant_id, inventory_lot_id,
        adjustment_type, quantity, reason, reference_type, reference_id,
        created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, tenant_id, actor_id, product_variant_id, inventory_lot_id,
                adjustment_type, quantity, reason, reference_type, reference_id,
                created_by_user_id, metadata, created_at
      `,
      [
        tenantId,
        input.actorId,
        input.productVariantId,
        input.inventoryLotId || null,
        input.adjustmentType,
        input.quantity,
        input.reason,
        input.referenceType || null,
        input.referenceId || null,
        createdByUserId,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar ajuste de estoque');
    }

    return this.toAdjustment(row);
  }

  /**
   * Busca ajuste por ID
   */
  async getAdjustmentById(
    tenantId: string,
    adjustmentId: string
  ): Promise<InventoryAdjustment | null> {
    const row = await runQueryWithTenant<InventoryAdjustmentRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, product_variant_id, inventory_lot_id,
             adjustment_type, quantity, reason, reference_type, reference_id,
             created_by_user_id, metadata, created_at
      FROM inventory_adjustments
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, adjustmentId]
    );

    return row ? this.toAdjustment(row) : null;
  }

  /**
   * Lista ajustes
   */
  async listAdjustments(
    tenantId: string,
    options: ListInventoryAdjustmentsOptions = {}
  ): Promise<InventoryAdjustment[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(options.actorId);
      paramIndex++;
    }

    if (options.productVariantId) {
      conditions.push(`product_variant_id = $${paramIndex}`);
      params.push(options.productVariantId);
      paramIndex++;
    }

    if (options.adjustmentType) {
      conditions.push(`adjustment_type = $${paramIndex}`);
      params.push(options.adjustmentType);
      paramIndex++;
    }

    if (options.referenceType) {
      conditions.push(`reference_type = $${paramIndex}`);
      params.push(options.referenceType);
      paramIndex++;
    }

    if (options.referenceId) {
      conditions.push(`reference_id = $${paramIndex}`);
      params.push(options.referenceId);
      paramIndex++;
    }

    if (options.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(options.endDate);
      paramIndex++;
    }

    const limit = Math.min(Math.max(options.limit || 50, 1), 100);
    const offset = options.offset || 0;

    const rows = await runQueriesWithTenant<InventoryAdjustmentRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, product_variant_id, inventory_lot_id,
             adjustment_type, quantity, reason, reference_type, reference_id,
             created_by_user_id, metadata, created_at
      FROM inventory_adjustments
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
      `,
      params
    );

    return rows.map((row) => this.toAdjustment(row));
  }
}

export const inventoryAdjustmentRepository = new InventoryAdjustmentRepository();









