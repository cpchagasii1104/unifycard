// backend/src/modules/marketplace/inventory-balance.repository.ts
// SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
// Repository para saldos de estoque (READ MODEL OPCIONAL)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { InventoryBalance } from './inventory.types';

interface InventoryBalanceRow {
  product_variant_id: string;
  tenant_id: string;
  current_quantity: string;
  unit: string;
  updatedAt: Date;
}

class InventoryBalanceRepository {
  /**
   * Converte row para InventoryBalance
   */
  private toBalance(row: InventoryBalanceRow): InventoryBalance {
    return {
      productVariantId: row.product_variant_id,
      tenantId: row.tenant_id,
      currentQuantity: parseFloat(row.current_quantity),
      unit: row.unit,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Busca saldo de uma variante (read model)
   * ⚠️ Se não existir, retorna null (saldo pode ser calculado de movimentações)
   */
  async getBalance(
    tenantId: string,
    productVariantId: string
  ): Promise<InventoryBalance | null> {
    const row = await runQueryWithTenant<InventoryBalanceRow>(
      tenantId,
      `
      SELECT product_variant_id, tenant_id, current_quantity, unit, updatedAt
      FROM inventory_balances
      WHERE tenant_id = $1 AND product_variant_id = $2
      LIMIT 1
      `,
      [tenantId, productVariantId]
    );

    return row ? this.toBalance(row) : null;
  }

  /**
   * Atualiza ou cria saldo (read model)
   * ⚠️ Esta função atualiza o read model, mas a fonte da verdade é inventory_movements
   */
  async upsertBalance(
    tenantId: string,
    productVariantId: string,
    quantity: number,
    unit: string
  ): Promise<InventoryBalance> {
    const row = await runQueryWithTenant<InventoryBalanceRow>(
      tenantId,
      `
      INSERT INTO inventory_balances (
        product_variant_id, tenant_id, current_quantity, unit, updatedAt
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (product_variant_id)
      DO UPDATE SET
        current_quantity = $3,
        unit = $4,
        updatedAt = NOW()
      RETURNING product_variant_id, tenant_id, current_quantity, unit, updatedAt
      `,
      [productVariantId, tenantId, quantity, unit]
    );

    if (!row) {
      throw new Error('Erro ao atualizar saldo');
    }

    return this.toBalance(row);
  }

  /**
   * Lista saldos de múltiplas variantes (read model)
   */
  async listBalances(
    tenantId: string,
    productVariantIds?: string[]
  ): Promise<InventoryBalance[]> {
    let query = `
      SELECT product_variant_id, tenant_id, current_quantity, unit, updatedAt
      FROM inventory_balances
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (productVariantIds && productVariantIds.length > 0) {
      query += ` AND product_variant_id = ANY($2::uuid[])`;
      params.push(productVariantIds);
    }

    query += ` ORDER BY updatedAt DESC`;

    const rows = await runQueriesWithTenant<InventoryBalanceRow>(
      tenantId,
      query,
      params
    );

    return rows.map((row) => this.toBalance(row));
  }
}

export const inventoryBalanceRepository = new InventoryBalanceRepository();









