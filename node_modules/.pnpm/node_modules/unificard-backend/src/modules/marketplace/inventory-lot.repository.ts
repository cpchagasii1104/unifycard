// backend/src/modules/marketplace/inventory-lot.repository.ts
// SPRINT 37.4: MARKETPLACE CORE - Lote & Validade (Opt-In)
// Repository para lotes de estoque

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  InventoryLot,
  CreateInventoryLotInput,
} from './inventory.types';

interface InventoryLotRow {
  id: string;
  tenant_id: string;
  product_variant_id: string;
  lot_code: string;
  manufacture_date: Date | null;
  expiration_date: Date | null;
  metadata: any;
  created_at: Date;
}

class InventoryLotRepository {
  /**
   * Converte row para InventoryLot
   */
  private toLot(row: InventoryLotRow): InventoryLot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productVariantId: row.product_variant_id,
      lotCode: row.lot_code,
      manufactureDate: row.manufacture_date,
      expirationDate: row.expiration_date,
      metadata: row.metadata || null,
      createdAt: row.created_at,
    };
  }

  /**
   * Cria lote
   */
  async createLot(
    tenantId: string,
    input: CreateInventoryLotInput
  ): Promise<InventoryLot> {
    const row = await runQueryWithTenant<InventoryLotRow>(
      tenantId,
      `
      INSERT INTO inventory_lots (
        tenant_id, product_variant_id, lot_code, manufacture_date,
        expiration_date, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tenant_id, product_variant_id, lot_code, manufacture_date,
                expiration_date, metadata, created_at
      `,
      [
        tenantId,
        input.productVariantId,
        input.lotCode,
        input.manufactureDate || null,
        input.expirationDate || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar lote');
    }

    return this.toLot(row);
  }

  /**
   * Busca lote por ID
   */
  async getLotById(
    tenantId: string,
    lotId: string
  ): Promise<InventoryLot | null> {
    const row = await runQueryWithTenant<InventoryLotRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, lot_code, manufacture_date,
             expiration_date, metadata, created_at
      FROM inventory_lots
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, lotId]
    );

    return row ? this.toLot(row) : null;
  }

  /**
   * Busca lote por código e variante
   */
  async getLotByCode(
    tenantId: string,
    productVariantId: string,
    lotCode: string
  ): Promise<InventoryLot | null> {
    const row = await runQueryWithTenant<InventoryLotRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, lot_code, manufacture_date,
             expiration_date, metadata, created_at
      FROM inventory_lots
      WHERE tenant_id = $1
        AND product_variant_id = $2
        AND lot_code = $3
      LIMIT 1
      `,
      [tenantId, productVariantId, lotCode]
    );

    return row ? this.toLot(row) : null;
  }

  /**
   * Lista lotes de uma variante
   */
  async listLotsByVariant(
    tenantId: string,
    productVariantId: string
  ): Promise<InventoryLot[]> {
    const rows = await runQueriesWithTenant<InventoryLotRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, lot_code, manufacture_date,
             expiration_date, metadata, created_at
      FROM inventory_lots
      WHERE tenant_id = $1 AND product_variant_id = $2
      ORDER BY lot_code ASC
      `,
      [tenantId, productVariantId]
    );

    return rows.map((row) => this.toLot(row));
  }
}

export const inventoryLotRepository = new InventoryLotRepository();







