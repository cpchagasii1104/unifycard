/**
 * Checagens de integridade de categorias / company_types / N1 (sem migrations).
 * Uso: cron, CI, pós-deploy. Falha com exit 1 se qualquer invariante quebrar.
 *
 * Espelha `scripts/post_seed_integrity_checks.sql` — manter em sincronia.
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'CATEGORY_INTEGRITY_CHECK_FAILED',
      check: 'env',
      message: 'DATABASE_URL ausente',
      timestamp: new Date().toISOString(),
    })
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  min: Number(process.env.DATABASE_POOL_MIN || 0),
  max: Number(process.env.DATABASE_POOL_MAX || 5),
});

interface FailedCheck {
  name: string;
  detail: unknown;
}

async function main(): Promise<number> {
  const client = await pool.connect();
  const failed: FailedCheck[] = [];

  try {
    const r1 = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM categories c
       LEFT JOIN category_n1_mapping m ON m.category_id = c.category_id
       WHERE c.metadata->>'domain' = 'marketplace' AND m.category_id IS NULL`
    );
    const marketplaceWithoutN1 = r1.rows[0]?.c ?? 0;
    if (marketplaceWithoutN1 > 0) {
      failed.push({ name: 'marketplace_categories_without_n1', detail: { count: marketplaceWithoutN1 } });
    }

    const r1b = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM categories c
       LEFT JOIN category_n1_mapping m ON m.category_id = c.category_id
       WHERE c.metadata->>'domain' = 'servicos' AND c.is_active = true AND m.category_id IS NULL`
    );
    const servicosWithoutN1 = r1b.rows[0]?.c ?? 0;
    if (servicosWithoutN1 > 0) {
      failed.push({
        name: 'servicos_operational_categories_without_n1',
        detail: { count: servicosWithoutN1 },
      });
    }

    const r2 = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM company_types ct
       LEFT JOIN company_type_allowed_concepts ctac ON ctac.company_type_id = ct.id
       WHERE ctac.company_type_id IS NULL`
    );
    const companyTypesWithoutConcept = r2.rows[0]?.c ?? 0;
    if (companyTypesWithoutConcept > 0) {
      failed.push({
        name: 'company_types_without_allowed_concept',
        detail: { count: companyTypesWithoutConcept },
      });
    }

    const r3 = await client.query<{ slug: string; cnt: number }>(
      `SELECT slug, COUNT(*)::int AS cnt
       FROM categories
       GROUP BY slug
       HAVING COUNT(*) > 1`
    );
    if (r3.rows.length > 0) {
      failed.push({ name: 'duplicate_category_slugs', detail: r3.rows });
    }

    const r4 = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM category_n1_mapping m
       LEFT JOIN categories c ON c.category_id = m.category_id
       WHERE c.category_id IS NULL`
    );
    if ((r4.rows[0]?.c ?? 0) > 0) {
      failed.push({ name: 'orphan_category_n1_mapping', detail: { count: r4.rows[0]!.c } });
    }

    const r5 = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c
       FROM category_n1_mapping m
       LEFT JOIN n1_nodes n ON n.n1_id = m.n1_id
       WHERE n.n1_id IS NULL`
    );
    if ((r5.rows[0]?.c ?? 0) > 0) {
      failed.push({ name: 'category_n1_mapping_invalid_n1', detail: { count: r5.rows[0]!.c } });
    }
  } finally {
    client.release();
    await pool.end();
  }

  if (failed.length > 0) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'CATEGORY_INTEGRITY_CHECK_FAILED',
        timestamp: new Date().toISOString(),
        module: 'scripts.run_category_integrity_checks',
        failedChecks: failed,
      })
    );
    return 1;
  }

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'category_integrity_check_ok',
      timestamp: new Date().toISOString(),
      module: 'scripts.run_category_integrity_checks',
    })
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'CATEGORY_INTEGRITY_CHECK_FAILED',
        timestamp: new Date().toISOString(),
        module: 'scripts.run_category_integrity_checks',
        message: err instanceof Error ? err.message : String(err),
      })
    );
    process.exit(1);
  });