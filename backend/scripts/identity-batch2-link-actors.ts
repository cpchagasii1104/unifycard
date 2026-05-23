import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env') });

import { pool } from '../src/core/db/pool';

async function main() {
  const client = await pool.connect();

  try {
    const candidates = await client.query(`
      SELECT a.id, a.tenant_id, a.user_id, u.global_user_id
      FROM actors a
      JOIN users u ON u.user_id = a.user_id AND u.tenant_id = a.tenant_id
      WHERE a.actor_type IN ('user', 'person', 'actor_human')
        AND a.global_user_id IS NULL
        AND a.is_identity_required = true
        AND a.user_id IS NOT NULL
        AND u.global_user_id IS NOT NULL
    `);

    console.log(`Candidatos Batch 2: ${candidates.rowCount}`);
    let ok = 0;
    let unresolved = 0;

    for (const row of candidates.rows) {
      try {
        await client.query(
          `
          UPDATE actors
          SET global_user_id = $1, updated_at = now()
          WHERE id = $2
            AND tenant_id = $3
            AND global_user_id IS NULL
          `,
          [row.global_user_id, row.id, row.tenant_id],
        );
        ok++;
      } catch (err) {
        unresolved++;
        console.error(`  ERRO actor_id=${row.id}:`, err);
      }
    }

    console.log(`Batch 2: ${ok} vinculados, ${unresolved} nao resolvidos -> CP-5`);
    if (unresolved > 0) {
      process.exit(2);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
