// src/scripts/create-dev-user.ts
//
// Script de seed para criar usuário de teste local
// NÃO é feature de produto, é seed de desenvolvimento
//
// Credenciais fixas:
// - Tenant slug: dev-tenant
// - Email: dev@unificard.local
// - Senha: dev1234

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  process.exit(1);
}

const TENANT_SLUG = 'dev-tenant';
const TENANT_NAME = 'Dev Tenant';
const DEV_EMAIL = 'dev@unificard.local';
const DEV_PASSWORD = 'dev12345'; // Mínimo 8 caracteres (requisito do schema)

type TenantRow = {
  id: string;
  name: string;
  slug: string;
};

type UserRow = {
  user_id: string;
  email: string;
};

type TenantRecord = {
  tenantId: string;
  name: string;
  slug: string;
};

type UserRecord = {
  userId: string;
  email: string;
};

// boundary: DB -> domain mapping
function mapTenantRowToDomain(row: TenantRow): TenantRecord {
  return {
    tenantId: row.id,
    name: row.name,
    slug: row.slug,
  };
}

function mapUserRowToDomain(row: UserRow): UserRecord {
  return {
    userId: row.user_id,
    email: row.email,
  };
}

/**
 * Cria ou obtém o tenant de desenvolvimento
 */
async function createOrGetDevTenant() {
  console.log('📦 Verificando tenant de desenvolvimento...');

  const client = await pool.connect();
  try {
    const existingResult = await client.query<TenantRow>({
      text: `
        SELECT id, name, slug
        FROM tenants
        WHERE slug = $1
        LIMIT 1
      `,
      values: [TENANT_SLUG],
    });

    if (existingResult.rows.length > 0) {
      const existingTenant = mapTenantRowToDomain(existingResult.rows[0]!);
      const tenantId = existingTenant.tenantId;
      console.log(`✅ Tenant "${TENANT_NAME}" já existe`);
      console.log(`   Slug: ${TENANT_SLUG}`);
      console.log(`   ID: ${tenantId}`);
      return tenantId;
    }
  } finally {
    client.release();
  }

  const created = await tenantService.createTenant({ name: TENANT_NAME, slug: TENANT_SLUG });
  const tenantId = created.tenantId;
  console.log(`✅ Tenant "${TENANT_NAME}" criado`);
  console.log(`   Slug: ${TENANT_SLUG}`);
  console.log(`   ID: ${tenantId}`);
  return tenantId;
}

/**
 * Cria ou obtém o usuário de desenvolvimento
 */
async function createOrGetDevUser(tenantId: string) {
  console.log('📦 Verificando usuário de desenvolvimento...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

    // Verifica se o usuário já existe
    const existingResult = await client.query<UserRow>({
      text: `
        SELECT user_id, email
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      values: [DEV_EMAIL.toLowerCase()],
    });

    if (existingResult.rows.length > 0) {
      const existingUser = mapUserRowToDomain(existingResult.rows[0]!);
      console.log(`✅ Usuário "${DEV_EMAIL}" já existe`);
      console.log(`   ID: ${existingUser.userId}`);
      
      // Atualizar senha para garantir que está correta
      const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
      await client.query({
        text: `
          UPDATE users
          SET password_hash = $1, updated_at = now()
          WHERE user_id = $2
        `,
        values: [passwordHash, existingUser.userId],
      });
      console.log(`   Senha atualizada para: ${DEV_PASSWORD}`);
      
      await client.query('COMMIT');
      return existingUser.userId;
    }

    // Cria o hash da senha (mesmo método do sistema: bcrypt com salt rounds 10)
    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

    // Cria o usuário
    const result = await client.query<UserRow>({
      text: `
        INSERT INTO users (tenant_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING user_id, email
      `,
      values: [tenantId, DEV_EMAIL.toLowerCase(), passwordHash],
    });

    if (result.rows.length === 0) {
      throw new Error('Falha ao criar usuário de desenvolvimento');
    }

    const createdUser = mapUserRowToDomain(result.rows[0]!);

    console.log(`✅ Usuário "${DEV_EMAIL}" criado`);
    console.log(`   ID: ${createdUser.userId}`);
    await client.query('COMMIT');
    return createdUser.userId;
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
  console.log('🚀 Criando usuário de teste local...\n');

  try {
    // 1. Cria ou obtém o tenant
    const tenantId = await createOrGetDevTenant();
    console.log('');

    // 2. Cria ou obtém o usuário
    const userId = await createOrGetDevUser(tenantId);
    console.log('');

    console.log('✨ Usuário de teste criado com sucesso!');
    console.log('\n📋 Credenciais para login no frontend:');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Email: ${DEV_EMAIL}`);
    console.log(`   Senha: ${DEV_PASSWORD}`);
    console.log('\n💡 Nota: Use o Tenant ID (UUID) acima no campo "Tenant ID" do login.');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Erro ao criar usuário de teste:');
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

