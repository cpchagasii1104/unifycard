import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env') });

import { identityService } from '../src/core/identity/identity.service';
import { pool } from '../src/core/db/pool';

async function main() {
  const client = await pool.connect();

  try {
    const orphans = await client.query(`
      SELECT g.global_user_id
      FROM global_users g
      WHERE NOT EXISTS (
        SELECT 1 FROM identities i WHERE i.global_user_id = g.global_user_id
      )
    `);

    console.log(`Encontrados ${orphans.rowCount} global_users sem identity.`);
    let ok = 0;
    let errors = 0;

    for (const row of orphans.rows) {
      try {
        await identityService.ensureIdentityRowForGlobalUserId(row.global_user_id);
        ok++;

        if (ok % 50 === 0) {
          console.log(`  Processados: ${ok}/${orphans.rowCount}`);
        }
      } catch (err) {
        errors++;
        console.error(`  ERRO global_user_id=${row.global_user_id}:`, err);
      }
    }

    console.log(`\nBatch 1 concluido: ${ok} OK, ${errors} erros`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
