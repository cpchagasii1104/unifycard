/**
 * Seed mínimo: 1 company + company_users + actor page para destravar fluxo social.
 * Não altera código de produção; usa tenant/user/global_user já existentes.
 *
 * Uso: pnpm seed:minimal:social  (ou: pnpm exec tsx src/scripts/seed-minimal-social.ts)
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { actorRepository } from '../modules/social/actor.repository';

dotenv.config({ path: join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Script bloqueado em NODE_ENV=production');
  process.exit(1);
}

const COMPANY_NAME = 'Empresa Teste';

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const userRes = await client.query<{
      id: string;
      user_id: string;
      tenant_id: string;
      global_user_id: string;
    }>(
      `
      SELECT id, user_id, tenant_id, global_user_id
      FROM users
      WHERE global_user_id IS NOT NULL
      LIMIT 1
      `
    );

    if (userRes.rows.length === 0) {
      throw new Error(
        'Nenhum utilizador com global_user_id. Corra seed:dev:user (ou equivalente) primeiro.'
      );
    }

    const { tenant_id, global_user_id, user_id } = userRes.rows[0];

    await client.query('BEGIN');

    let companyId: string;
    const existingCompany = await client.query<{ company_id: string }>(
      `
      SELECT company_id
      FROM companies
      WHERE tenant_id = $1 AND company_name = $2
      LIMIT 1
      `,
      [tenant_id, COMPANY_NAME]
    );

    if (existingCompany.rows.length > 0) {
      companyId = existingCompany.rows[0].company_id;
      console.log('ℹ️  Company já existia:', companyId);
    } else {
      const ins = await client.query<{ company_id: string }>(
        `
        INSERT INTO companies (
          tenant_id,
          company_name,
          trade_name,
          status,
          company_status
        )
        VALUES ($1, $2, $3, 'active', 'ACTIVE')
        RETURNING company_id
        `,
        [tenant_id, COMPANY_NAME, COMPANY_NAME]
      );
      companyId = ins.rows[0].company_id;
      console.log('✅ Company criada:', companyId);
    }

    const existingLink = await client.query(
      `
      SELECT id FROM company_users
      WHERE company_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [companyId, global_user_id]
    );

    if (existingLink.rows.length === 0) {
      await client.query(
        `
        INSERT INTO company_users (
          tenant_id,
          company_id,
          global_user_id,
          role,
          is_primary,
          is_active,
          can_manage_company
        )
        VALUES ($1, $2, $3, 'owner', true, true, true)
        `,
        [tenant_id, companyId, global_user_id]
      );
      console.log('✅ company_users vinculado (owner).');
    } else {
      console.log('ℹ️  company_users já existia.');
    }

    await client.query('COMMIT');

    const userActor = await actorRepository.findOrCreateUserActor(tenant_id, user_id);
    const pageActor = await actorRepository.findOrCreatePageActor(
      tenant_id,
      companyId,
      userActor.actor_id
    );
    console.log('✅ Actor page:', pageActor.actor_id, 'slug:', pageActor.slug);

    console.log('\n📌 Para testar GET /social/actors/available use o JWT deste tenant.');
    console.log('   user_id:', user_id);
    console.log('   tenant_id:', tenant_id);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌', e);
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });