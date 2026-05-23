import dotenv from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';
import { writeFileSync, mkdirSync } from 'fs';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        a.id              AS actor_id,
        a.tenant_id,
        a.actor_type,
        a.display_name,
        a.user_id,
        a.external_id,
        a.is_identity_required,
        CASE
          WHEN a.user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.user_id = a.user_id AND u.global_user_id IS NOT NULL
          ) THEN 'user_exists_gu_null'
          WHEN a.user_id IS NOT NULL THEN 'would_batch2_user_id'
          ELSE 'no_genesis_user'
        END AS batch2_hint
      FROM actors a
      WHERE a.actor_type IN ('user', 'person', 'actor_human')
        AND a.global_user_id IS NULL
        AND a.is_identity_required = true
      ORDER BY a.actor_type, a.tenant_id
    `);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = join(process.cwd(), 'artifacts');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `identity-cp5-a2-export-${timestamp}.csv`);

    const header = Object.keys(result.rows[0] ?? {}).join(',');
    const rows = result.rows.map((r) => Object.values(r).join(','));
    writeFileSync(path, [header, ...rows].join('\n'), 'utf-8');

    console.log(`Exportado: ${path}`);
    console.log(`Total A2 elegiveis: ${result.rowCount}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
