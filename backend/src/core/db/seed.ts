// src/core/db/seed.ts
//
// Script de seed para popular o banco com dados iniciais:
// - Tenant "unificard"
// - Role admin com todas as permissões
// - Usuário admin@unificard.com com senha 123456

import bcrypt from 'bcrypt';
import { join } from 'path';
import { pool } from '../database/pool';
import { tenantService } from '../tenants/tenant.service';
import { BACKEND_ROOT } from './load-backend-env';

// `pool` import já executa `loadBackendEnv()` (ver `database/pool.ts`).

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  console.error(`   Defina DATABASE_URL em ${join(BACKEND_ROOT, '.env')} ou no ambiente`);
  process.exit(1);
}

const TENANT_NAME = 'unificard';
const TENANT_SLUG = 'unificard';
const ADMIN_EMAIL = 'admin@unificard.com';
const ADMIN_PASSWORD = '123456';

/**
 * Cria ou obtém o tenant
 */
async function createOrGetTenant() {
  console.log('📦 Verificando tenant...');

  // Verifica se o tenant já existe
  const client = await pool.connect();
  try {
    const existingResult = await client.query<{ id: string; name: string; slug: string }>({
      text: `
        SELECT id, name, slug
        FROM tenants
        WHERE slug = $1
        LIMIT 1
      `,
      values: [TENANT_SLUG],
    });

    if (existingResult.rows.length > 0) {
      const tid = existingResult.rows[0].id;
      console.log(`✅ Tenant "${TENANT_NAME}" já existe (ID: ${tid})`);
      return tid;
    }
  } finally {
    client.release();
  }

  const created = await tenantService.createTenant({ name: TENANT_NAME, slug: TENANT_SLUG });
  console.log(`✅ Tenant "${TENANT_NAME}" criado (ID: ${created.tenantId})`);
  return created.tenantId;
}

/**
 * Cria roles e permissões usando a função SQL seed_default_rbac
 */
async function seedRBAC(tenantId: string) {
  console.log('📦 Verificando roles e permissões...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // Verifica se a role admin já existe
    const existingResult = await client.query<{ role_id: string }>({
      text: `
        SELECT role_id
        FROM roles
        WHERE tenant_id = $1 AND name = 'admin'
        LIMIT 1
      `,
      values: [tenantId],
    });

    if (existingResult.rows.length > 0) {
      console.log('✅ Roles e permissões já existem');
      await client.query('COMMIT');
      return;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Se não existir, cria usando a função SQL
  console.log('📦 Criando roles e permissões...');
  const client2 = await pool.connect();
  try {
    await client2.query({
      text: `SELECT seed_default_rbac($1)`,
      values: [tenantId],
    });
    console.log('✅ Roles e permissões criadas');
  } finally {
    client2.release();
  }
}

/**
 * Cria ou obtém o usuário admin
 */
async function createOrGetAdminUser(tenantId: string) {
  console.log('📦 Verificando usuário admin...');

  // Verifica se o usuário já existe
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const existingResult = await client.query<{ user_id: string; email: string }>({
      text: `
        SELECT user_id, email
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      values: [ADMIN_EMAIL.toLowerCase()],
    });

    if (existingResult.rows.length > 0) {
      console.log(`✅ Usuário "${ADMIN_EMAIL}" já existe (ID: ${existingResult.rows[0].user_id})`);
      return existingResult.rows[0].user_id;
    }

    // Cria o hash da senha
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Cria o usuário
    const result = await client.query<{ user_id: string; email: string }>({
      text: `
        INSERT INTO users (tenant_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING user_id, email
      `,
      values: [tenantId, ADMIN_EMAIL.toLowerCase(), passwordHash],
    });

    if (result.rows.length === 0) {
      throw new Error('Falha ao criar usuário admin');
    }

    console.log(`✅ Usuário "${ADMIN_EMAIL}" criado (ID: ${result.rows[0].user_id})`);
    await client.query('COMMIT');
    return result.rows[0].user_id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atribui a role admin ao usuário
 */
async function assignAdminRole(tenantId: string, userId: string) {
  console.log('📦 Atribuindo role admin ao usuário...');

  // Busca a role admin
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    const adminRoleResult = await client.query<{ role_id: string; name: string }>({
      text: `
        SELECT role_id, name
        FROM roles
        WHERE tenant_id = $1 AND name = 'admin'
        LIMIT 1
      `,
      values: [tenantId],
    });

    if (adminRoleResult.rows.length === 0) {
      throw new Error('Role admin não encontrada. Certifique-se de que seed_default_rbac foi executado.');
    }

    const adminRole = adminRoleResult.rows[0];

    // Verifica se a role já está atribuída
    const existingResult = await client.query<{ user_role_id: string }>({
      text: `
        SELECT user_role_id
        FROM user_roles
        WHERE tenant_id = $1 AND user_id = $2 AND role_id = $3
        LIMIT 1
      `,
      values: [tenantId, userId, adminRole.role_id],
    });

    if (existingResult.rows.length > 0) {
      console.log('✅ Role admin já está atribuída ao usuário');
      return;
    }

    // Atribui a role
    await client.query({
      text: `
        INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
        VALUES ($1, $2, $3, $2)
        ON CONFLICT (tenant_id, user_id, role_id) DO NOTHING
      `,
      values: [tenantId, userId, adminRole.role_id],
    });

    console.log('✅ Role admin atribuída ao usuário');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando processo de seed...\n');

  try {
    // 1. Cria ou obtém o tenant
    const tenantId = await createOrGetTenant();
    console.log('');

    // 2. Cria roles e permissões
    await seedRBAC(tenantId);
    console.log('');

    // 3. Cria ou obtém o usuário admin
    const userId = await createOrGetAdminUser(tenantId);
    console.log('');

    // 4. Atribui a role admin ao usuário
    await assignAdminRole(tenantId, userId);
    console.log('');

    console.log('✨ Seed concluído com sucesso!');
    console.log('\n📋 Resumo:');
    console.log(`   Tenant: ${TENANT_NAME} (${tenantId})`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Senha: ${ADMIN_PASSWORD}`);
    console.log(`   Role: admin (com todas as permissões)`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Erro fatal durante o seed:');
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Executa o script
main().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});

