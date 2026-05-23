/**
 * INFRA-3 — Rebuild de `inventory_balances` a partir de `inventory_movements` (SSOT).
 * Não altera movements. Transação por tenant; upserts em chunks por variantes.
 *
 * Uso: cd backend && npx tsx scripts/rebuild-inventory-balances.ts
 *      npx tsx scripts/rebuild-inventory-balances.ts --tenant_id=<uuid>
 *      npx tsx scripts/rebuild-inventory-balances.ts --drift-only
 *      npx tsx scripts/rebuild-inventory-balances.ts --tenant_id=<uuid> --drift-only
 *
 * Drift-1 (balance vs movements): este script + sql/inventory_balances_drift_vs_movements.sql
 * Drift-2 (reservas ACTIVE vs on-hand): sql/inventory_reserved_exceeds_onhand.sql — docs/runbooks/inventory-semantics.md
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { Pool, type PoolClient, type QueryResult } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const CHUNK_VARIANTS = 500;

export type DriftRow = {
  product_variant_id: string;
  balance: string;
  movements_sum: string;
  drift: string;
};

function parseArgs(argv: string[]): { tenantId: string | null; driftOnly: boolean } {
  let tenantId: string | null = null;
  let driftOnly = false;
  for (const a of argv) {
    if (a === '--drift-only') driftOnly = true;
    else if (a.startsWith('--tenant_id=')) tenantId = a.slice('--tenant_id='.length).trim() || null;
  }
  return { tenantId, driftOnly };
}

async function listTenantIds(client: PoolClient, filterTenant: string | null): Promise<string[]> {
  if (filterTenant) {
    const check = await client.query(`SELECT 1 FROM tenants WHERE id = $1::uuid`, [filterTenant]);
    if (check.rowCount === 0) {
      throw new Error(`tenant_id não existe: ${filterTenant}`);
    }
    return [filterTenant];
  }
  const r = await client.query<{ id: string }>(`SELECT id::text FROM tenants ORDER BY id`);
  return r.rows.map((row) => row.id);
}

async function rebuildTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);

  let lastVariant: string | null = null;
  for (;;) {
    const variantPage: QueryResult<{ product_variant_id: string }> = await client.query(
      `
      SELECT DISTINCT im.product_variant_id
      FROM inventory_movements im
      WHERE im.tenant_id = $1::uuid
        AND ($2::uuid IS NULL OR im.product_variant_id > $2::uuid)
      ORDER BY im.product_variant_id ASC
      LIMIT $3
      `,
      [tenantId, lastVariant, CHUNK_VARIANTS]
    );
    if (variantPage.rows.length === 0) break;

    const ids: string[] = variantPage.rows.map((row) => row.product_variant_id);
    lastVariant = ids[ids.length - 1]!;

    await client.query(
      `
      WITH sums AS (
        SELECT im.tenant_id,
               im.product_variant_id,
               COALESCE(SUM(
                 CASE im.movement_type
                   WHEN 'IN' THEN im.quantity
                   WHEN 'OUT' THEN -im.quantity
                   ELSE im.quantity
                 END
               ), 0)::numeric(20,4) AS q
        FROM inventory_movements im
        WHERE im.tenant_id = $1::uuid
          AND im.product_variant_id = ANY($2::uuid[])
        GROUP BY im.tenant_id, im.product_variant_id
      )
      INSERT INTO inventory_balances (product_variant_id, tenant_id, current_quantity, unit, updated_at)
      SELECT s.product_variant_id,
             s.tenant_id,
             s.q,
             COALESCE(NULLIF(TRIM(pv.sale_unit), ''), 'un'),
             NOW()
      FROM sums s
      INNER JOIN product_variants pv
        ON pv.id = s.product_variant_id AND pv.tenant_id = s.tenant_id
      ON CONFLICT (product_variant_id) DO UPDATE SET
        current_quantity = EXCLUDED.current_quantity,
        unit = EXCLUDED.unit,
        updated_at = EXCLUDED.updated_at,
        tenant_id = EXCLUDED.tenant_id
      `,
      [tenantId, ids]
    );
  }

  await client.query(
    `
    UPDATE inventory_balances ib
    SET current_quantity = 0,
        updated_at = NOW()
    WHERE ib.tenant_id = $1::uuid
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements im
        WHERE im.tenant_id = ib.tenant_id
          AND im.product_variant_id = ib.product_variant_id
      )
    `,
    [tenantId]
  );
}

async function driftRowsForTenant(client: PoolClient, tenantId: string): Promise<DriftRow[]> {
  await client.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
  const r = await client.query<DriftRow>(
    `
    SELECT
      ib.product_variant_id::text,
      ib.current_quantity::text AS balance,
      SUM(
        CASE im.movement_type
          WHEN 'IN' THEN im.quantity
          WHEN 'OUT' THEN -im.quantity
          ELSE im.quantity
        END
      )::text AS movements_sum,
      ABS(ib.current_quantity - SUM(
        CASE im.movement_type
          WHEN 'IN' THEN im.quantity
          WHEN 'OUT' THEN -im.quantity
          ELSE im.quantity
        END
      ))::text AS drift
    FROM inventory_balances ib
    JOIN inventory_movements im
      ON im.product_variant_id = ib.product_variant_id
      AND im.tenant_id = ib.tenant_id
    WHERE ib.tenant_id = $1::uuid
    GROUP BY ib.tenant_id, ib.product_variant_id, ib.current_quantity
    HAVING ABS(ib.current_quantity - SUM(
      CASE im.movement_type
        WHEN 'IN' THEN im.quantity
        WHEN 'OUT' THEN -im.quantity
        ELSE im.quantity
      END
    )) > 0
    ORDER BY ib.product_variant_id
    `,
    [tenantId]
  );
  return r.rows;
}

/**
 * Rebuild de `inventory_balances` para um tenant (transacção única). Para testes §7 / PROD-7.
 */
export async function rebuildInventoryBalancesForTenant(pool: Pool, tenantId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await rebuildTenant(client, tenantId);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Compara saldo do read model com soma canónica dos movements (mesma fórmula do plano INFRA-3). */
export async function compareBalancesVsMovements(
  pool: Pool,
  tenantId: string | null
): Promise<DriftRow[]> {
  const client = await pool.connect();
  try {
    if (tenantId) {
      return await driftRowsForTenant(client, tenantId);
    }
    const tenants = await client.query<{ id: string }>(
      `SELECT DISTINCT ib.tenant_id::text AS id FROM inventory_balances ib ORDER BY id`
    );
    const acc: DriftRow[] = [];
    for (const { id } of tenants.rows) {
      acc.push(...(await driftRowsForTenant(client, id)));
    }
    return acc;
  } finally {
    client.release();
  }
}

export async function runCli(): Promise<void> {
  const { tenantId: filterTenant, driftOnly } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    if (driftOnly) {
      const drift = await compareBalancesVsMovements(pool, filterTenant);
      console.log(JSON.stringify({ driftRows: drift.length, rows: drift }, null, 2));
      return;
    }

    const tenantIds = await listTenantIds(client, filterTenant);
    console.log(`Rebuild: ${tenantIds.length} tenant(s)`);

    for (const tid of tenantIds) {
      await client.query('BEGIN');
      try {
        await rebuildTenant(client, tid);
        await client.query('COMMIT');
        console.log(`OK tenant ${tid}`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Falha tenant ${tid}`, e);
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}