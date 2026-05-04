// backend/src/modules/marketplace/inventory-movement.repository.ts
// SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
// Repository para movimentações de estoque

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  InventoryMovement,
  CreateInventoryMovementInput,
  ListInventoryMovementsOptions,
} from './inventory.types';

interface InventoryMovementRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  product_variant_id: string;
  movement_type: string;
  quantity: string;
  unit: string;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  inventory_lot_id: string | null; // SPRINT 37.4: Lote opcional
  metadata: any;
  created_by_user_id: string | null;
  created_at: Date;
}

class InventoryMovementRepository {
  /**
   * Converte row para InventoryMovement
   */
  private toMovement(row: InventoryMovementRow): InventoryMovement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      productVariantId: row.product_variant_id,
      movementType: row.movement_type as any,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      reason: row.reason,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      inventoryLotId: row.inventory_lot_id, // SPRINT 37.4: Lote opcional
      metadata: row.metadata || null,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria movimentação
   */
  async createMovement(
    tenantId: string,
    input: CreateInventoryMovementInput
  ): Promise<InventoryMovement> {
    const row = await runQueryWithTenant<InventoryMovementRow>(
      tenantId,
      `
      INSERT INTO inventory_movements (
        tenant_id, actor_id, product_variant_id, movement_type, quantity, unit,
        reason, reference_type, reference_id, inventory_lot_id, metadata, created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, tenant_id, actor_id, product_variant_id, movement_type, quantity,
                unit, reason, reference_type, reference_id, inventory_lot_id, metadata,
                created_by_user_id, created_at
      `,
      [
        tenantId,
        input.actorId,
        input.productVariantId,
        input.movementType,
        input.quantity,
        input.unit || 'un',
        input.reason || null,
        input.referenceType || null,
        input.referenceId || null,
        input.inventoryLotId || null, // SPRINT 37.4: Lote opcional
        JSON.stringify(input.metadata || {}),
        input.createdByUserId || null,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar movimentação');
    }

    return this.toMovement(row);
  }

  /**
   * Insert com client existente (transação). Requer app.current_tenant no client.
   */
  async createMovementWithClient(
    client: PoolClient,
    input: CreateInventoryMovementInput
  ): Promise<InventoryMovement> {
    const result = await client.query<InventoryMovementRow>(
      `
      INSERT INTO inventory_movements (
        tenant_id, actor_id, product_variant_id, movement_type, quantity, unit,
        reason, reference_type, reference_id, inventory_lot_id, metadata, created_by_user_id
      )
      VALUES (
        current_setting('app.current_tenant', true)::uuid,
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING id, tenant_id, actor_id, product_variant_id, movement_type, quantity,
                unit, reason, reference_type, reference_id, inventory_lot_id, metadata,
                created_by_user_id, created_at
      `,
      [
        input.actorId,
        input.productVariantId,
        input.movementType,
        input.quantity,
        input.unit || 'un',
        input.reason || null,
        input.referenceType || null,
        input.referenceId || null,
        input.inventoryLotId || null,
        JSON.stringify(input.metadata || {}),
        input.createdByUserId || null,
      ]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Erro ao criar movimentação');
    }
    return this.toMovement(row);
  }

  /**
   * Busca movimentações de uma variante
   */
  async getMovementsByVariant(
    tenantId: string,
    productVariantId: string,
    options: ListInventoryMovementsOptions = {}
  ): Promise<InventoryMovement[]> {
    const conditions: string[] = [
      'tenant_id = $1',
      'product_variant_id = $2',
    ];
    const params: any[] = [tenantId, productVariantId];
    let paramIndex = 3;

    if (options.movementType) {
      conditions.push(`movement_type = $${paramIndex}`);
      params.push(options.movementType);
      paramIndex++;
    }

    if (options.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(options.actorId);
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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

    const rows = await runQueriesWithTenant<InventoryMovementRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, product_variant_id, movement_type, quantity,
             unit, reason, reference_type, reference_id, inventory_lot_id, metadata,
             created_by_user_id, created_at
      FROM inventory_movements
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
      ${offsetClause}
      `,
      params
    );

    return rows.map((row) => this.toMovement(row));
  }

  /**
   * Calcula saldo atual de uma variante (derivado de movimentações)
   * Fonte da verdade: inventory_movements
   */
  async calculateBalance(
    tenantId: string,
    productVariantId: string
  ): Promise<{ quantity: number; unit: string }> {
    const result = await runQueryWithTenant<{
      total_quantity: string;
      unit: string;
    }>(
      tenantId,
      `
      SELECT 
        COALESCE(
          SUM(
            CASE 
              WHEN movement_type = 'IN' THEN quantity
              WHEN movement_type = 'OUT' THEN -quantity
              WHEN movement_type = 'ADJUSTMENT' THEN quantity
            END
          ),
          0
        )::text as total_quantity,
        COALESCE(MAX(unit), 'un') as unit
      FROM inventory_movements
      WHERE tenant_id = $1 AND product_variant_id = $2
      `,
      [tenantId, productVariantId]
    );

    return {
      quantity: parseFloat(result?.total_quantity || '0'),
      unit: result?.unit || 'un',
    };
  }

  /**
   * Mesmo cálculo que calculateBalance, na transação do client (obrigatório após lock na variante).
   */
  async calculateBalanceWithClient(
    client: PoolClient,
    tenantId: string,
    productVariantId: string
  ): Promise<{ quantity: number; unit: string }> {
    const { rows } = await client.query<{ total_quantity: string; unit: string }>(
      `
      SELECT 
        COALESCE(
          SUM(
            CASE 
              WHEN movement_type = 'IN' THEN quantity
              WHEN movement_type = 'OUT' THEN -quantity
              WHEN movement_type = 'ADJUSTMENT' THEN quantity
            END
          ),
          0
        )::text as total_quantity,
        COALESCE(MAX(unit), 'un') as unit
      FROM inventory_movements
      WHERE tenant_id = $1 AND product_variant_id = $2
      `,
      [tenantId, productVariantId]
    );
    const row = rows[0];
    return {
      quantity: parseFloat(row?.total_quantity || '0'),
      unit: row?.unit || 'un',
    };
  }

  /**
   * Lock pessimista na linha da variante (mesma transação que saldo + OUT).
   * Ordenar chamadas por product_variant_id ASC no caller para evitar deadlock entre pedidos.
   */
  async lockProductVariantForUpdate(
    client: PoolClient,
    tenantId: string,
    productVariantId: string
  ): Promise<boolean> {
    const r = await client.query<{ id: string }>(
      `SELECT id FROM product_variants WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [productVariantId, tenantId]
    );
    return (r.rowCount ?? 0) > 0;
  }
}

export const inventoryMovementRepository = new InventoryMovementRepository();
