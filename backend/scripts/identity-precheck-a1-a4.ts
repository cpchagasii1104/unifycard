import dotenv from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    const a1 = await client.query(`
      SELECT COUNT(*)::bigint AS gu_sem_identities
      FROM global_users g
      WHERE NOT EXISTS (
        SELECT 1 FROM identities i WHERE i.global_user_id = g.global_user_id
      )
    `);

    const a2 = await client.query(`
      SELECT COUNT(*)::bigint AS human_sem_gu
      FROM actors
      WHERE actor_type IN ('user', 'person', 'actor_human')
        AND global_user_id IS NULL
        AND is_identity_required = true
    `);

    const a3 = await client.query(`
      SELECT COUNT(*)::bigint AS actor_gu_sem_identity
      FROM actors a
      WHERE a.global_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM identities i WHERE i.global_user_id = a.global_user_id
        )
    `);

    const a4 = await client.query(`
      SELECT tax_id, COUNT(*)::bigint AS n
      FROM identities
      GROUP BY tax_id
      HAVING COUNT(*) > 1
    `);

    console.log('=== IDENTITY PRECHECK A1-A4 ===');
    console.log('ENV:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    console.log(`A1 = ${a1.rows[0]?.gu_sem_identities ?? 0}`);
    console.log(`A2 = ${a2.rows[0]?.human_sem_gu ?? 0}`);
    console.log(`A3 = ${a3.rows[0]?.actor_gu_sem_identity ?? 0}`);
    console.log(`A4 = ${a4.rowCount} linhas duplicadas`);

    if (a4.rowCount > 0) {
      console.log('A4 detalhes:', JSON.stringify(a4.rows));
    }

    const allZero =
      Number(a1.rows[0]?.gu_sem_identities) === 0 &&
      Number(a2.rows[0]?.human_sem_gu) === 0 &&
      Number(a3.rows[0]?.actor_gu_sem_identity) === 0 &&
      a4.rowCount === 0;

    console.log('');
    console.log(
      allZero
        ? 'DB_OK - A1=A2=A3=A4=0 - GLOBAL BLOCK pode ser marcado INATIVO'
        : 'Ha inconsistencias - ver valores acima',
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
