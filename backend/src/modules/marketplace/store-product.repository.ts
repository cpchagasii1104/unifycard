// backend/src/modules/marketplace/store-product.repository.ts
// FASE X — Bloco 3: Store Products / Activations (persistência)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface StoreProductActivationRow {
  id: string;
  tenant_id: string;
  store_id: string;
  product_id: string;
  status: string;
  activated_at: Date;
  deactivated_at: Date | null;
}

class StoreProductRepository {
  async activateProduct(
    tenantId: string,
    storeId: string,
    productId: string
  ): Promise<StoreProductActivationRow> {
    const row = await runQueryWithTenant<StoreProductActivationRow>(
      tenantId,
      `
      INSERT INTO store_product_activations (tenant_id, store_id, product_id, status, activated_at)
      VALUES ($1, $2, $3, 'active', now())
      ON CONFLICT (tenant_id, store_id, product_id) DO UPDATE SET
        status = 'active',
        activated_at = now(),
        deactivated_at = NULL
      RETURNING id, tenant_id, store_id, product_id, status, activated_at, deactivated_at
      `,
      [tenantId, storeId, productId]
    );
    if (!row) throw new Error('Store product activation not upserted');
    return row;
  }

  async deactivateProduct(
    tenantId: string,
    storeId: string,
    productId: string
  ): Promise<StoreProductActivationRow> {
    const row = await runQueryWithTenant<StoreProductActivationRow>(
      tenantId,
      `
      UPDATE store_product_activations
      SET status = 'inactive', deactivated_at = now()
      WHERE tenant_id = $1 AND store_id = $2 AND product_id = $3
      RETURNING id, tenant_id, store_id, product_id, status, activated_at, deactivated_at
      `,
      [tenantId, storeId, productId]
    );
    if (!row) throw new Error('Store product activation not found');
    return row;
  }

  async listByStore(
    tenantId: string,
    storeId: string,
    activeOnly = true
  ): Promise<StoreProductActivationRow[]> {
    const rows = await runQueriesWithTenant<StoreProductActivationRow>(
      tenantId,
      activeOnly
        ? `SELECT id, tenant_id, store_id, product_id, status, activated_at, deactivated_at
           FROM store_product_activations WHERE tenant_id = $1 AND store_id = $2 AND status = 'active'`
        : `SELECT id, tenant_id, store_id, product_id, status, activated_at, deactivated_at
           FROM store_product_activations WHERE tenant_id = $1 AND store_id = $2`,
      [tenantId, storeId]
    );
    return rows;
  }

  async getActivation(
    tenantId: string,
    storeId: string,
    productId: string
  ): Promise<StoreProductActivationRow | null> {
    const row = await runQueryWithTenant<StoreProductActivationRow>(
      tenantId,
      `SELECT id, tenant_id, store_id, product_id, status, activated_at, deactivated_at
       FROM store_product_activations WHERE tenant_id = $1 AND store_id = $2 AND product_id = $3`,
      [tenantId, storeId, productId]
    );
    return row ?? null;
  }

  /** Inserir ou atualizar ativação (ex.: import com status inactive) */
  async upsertActivation(
    tenantId: string,
    storeId: string,
    productId: string,
    status: 'active' | 'inactive'
  ): Promise<StoreProductActivationRow> {
    const row = await runQueryWithTenant<StoreProductActivationRow>(
      tenantId,
      `
      INSERT INTO store_product_activations (tenant_id, store_id, product_id, status, activated_at, deactivated_at)
      VALUES ($1, $2, $3, $4, now(), CASE WHEN $4 = 'inactive' THEN now() ELSE NULL END)
      ON CONFLICT (tenant_id, store_id, product_id) DO UPDATE SET
        status = EXCLUDED.status,
        activated_at = CASE WHEN EXCLUDED.status = 'active' THEN now() ELSE store_product_activations.activated_at END,
        deactivated_at = CASE WHEN EXCLUDED.status = 'inactive' THEN now() ELSE NULL END
      RETURNING id, tenant_id, store_id, product_id, status, activated_at, deactivated_at
      `,
      [tenantId, storeId, productId, status]
    );
    if (!row) throw new Error('Store product activation not upserted');
    return row;
  }
}

export const storeProductRepository = new StoreProductRepository();