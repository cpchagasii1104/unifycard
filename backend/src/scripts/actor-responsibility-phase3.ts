/**
 * Fase 3 — backfill responsible_actor_id + validação obrigatória.
 * Executar após migration 20260510100000_actor_responsibility.sql.
 * Exit code 1 se existirem actors não-humanos sem responsável.
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { Pool } from 'pg';

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE actors a
      SET responsible_actor_id = best.actor_id
      FROM (
        SELECT DISTINCT ON (cu.company_id)
          cu.company_id,
          ua.id AS actor_id
        FROM company_users cu
        INNER JOIN users u
          ON u.global_user_id = cu.global_user_id
          AND u.tenant_id = cu.tenant_id
        INNER JOIN actors ua
          ON ua.user_id = u.user_id
          AND ua.tenant_id = u.tenant_id
          AND ua.actor_type IN ('user', 'actor_human', 'person')
        WHERE cu.is_active = true
          AND cu.can_manage_company = true
          AND cu.tenant_id = ua.tenant_id
        ORDER BY
          cu.company_id,
          (cu.role = 'owner') DESC,
          cu.created_at ASC
      ) AS best
      WHERE a.actor_type IN ('page', 'company', 'actor_organizational')
        AND a.company_id = best.company_id
        AND a.responsible_actor_id IS NULL
    `);
    await client.query('COMMIT');

    const pending = await client.query(`
      SELECT actor_type, COUNT(*)::text AS sem_responsavel
      FROM actors
      WHERE actor_type NOT IN ('user','actor_human','person','actor_system','system')
        AND responsible_actor_id IS NULL
      GROUP BY actor_type
      ORDER BY COUNT(*) DESC
    `);

    if (pending.rows.length > 0) {
      console.error('Fase 3 — VALIDAÇÃO FALHOU. Pendentes:');
      for (const r of pending.rows) {
        console.error(`  actor_type=${r.actor_type} sem_responsavel=${r.sem_responsavel}`);
      }
      process.exit(1);
    }

    console.log('Fase 3 — OK: zero actors não-humanos sem responsible_actor_id.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});