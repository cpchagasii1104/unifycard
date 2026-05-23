// src/scripts/verify-dev-user.ts
//
// Script de diagnóstico para verificar se o usuário DEV existe no banco
// e se pode ser encontrado pela query de login

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const DEV_EMAIL = 'dev@unificard.local';
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';

type DevUserRow = {
  user_id: string;
  tenant_id: string;
  email: string;
  token_version: number;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
};

type DevUserRecord = {
  userId: string;
  tenantId: string;
  email: string;
  tokenVersion: number;
};

type TenantRecord = {
  tenantId: string;
  name: string;
  slug: string;
};

// boundary: DB -> domain mapping
function mapDevUserRowToDomain(row: DevUserRow): DevUserRecord {
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    tokenVersion: row.token_version,
  };
}

function mapTenantRowToDomain(row: TenantRow): TenantRecord {
  return {
    tenantId: row.id,
    name: row.name,
    slug: row.slug,
  };
}

async function verifyDevUser() {
  console.log('🔍 Verificando usuário DEV no banco...\n');

  const client = await pool.connect();
  try {
    // 1. Buscar sem filtro de tenant
    console.log('1️⃣ Buscando usuário por email (sem filtro de tenant):');
    const result1 = await client.query<DevUserRow>(
      `SELECT user_id, tenant_id, email, token_version FROM users WHERE email = $1`,
      [DEV_EMAIL.toLowerCase()]
    );
    const usersByEmail = result1.rows.map(mapDevUserRowToDomain);
    console.log(`   Encontrados: ${usersByEmail.length} usuário(s)`);
    usersByEmail.forEach((user, i) => {
      console.log(`   [${i + 1}] User ID: ${user.userId}`);
      console.log(`       Tenant ID: ${user.tenantId}`);
      console.log(`       Email: ${user.email}`);
      console.log(`       Token Version: ${user.tokenVersion}`);
    });
    console.log('');

    // 2. Buscar com filtro de tenant
    console.log('2️⃣ Buscando usuário por tenant_id E email (query do login):');
    const result2 = await client.query<DevUserRow>(
      `SELECT user_id, tenant_id, email, token_version FROM users WHERE tenant_id = $1 AND email = $2`,
      [DEV_TENANT_ID, DEV_EMAIL.toLowerCase()]
    );
    const usersByTenant = result2.rows.map(mapDevUserRowToDomain);
    console.log(`   Encontrados: ${usersByTenant.length} usuário(s)`);
    usersByTenant.forEach((user, i) => {
      console.log(`   [${i + 1}] User ID: ${user.userId}`);
      console.log(`       Tenant ID: ${user.tenantId}`);
      console.log(`       Email: ${user.email}`);
      console.log(`       Token Version: ${user.tokenVersion}`);
    });
    console.log('');

    // 3. Verificar tenant
    console.log('3️⃣ Verificando se tenant existe:');
    const tenantResult = await client.query<TenantRow>(
      `SELECT id, name, slug FROM tenants WHERE id = $1`,
      [DEV_TENANT_ID]
    );
    console.log(`   Tenant encontrado: ${tenantResult.rows.length > 0 ? 'SIM' : 'NÃO'}`);
    if (tenantResult.rows.length > 0) {
      const tenant = mapTenantRowToDomain(tenantResult.rows[0]!);
      console.log(`   Name: ${tenant.name}`);
      console.log(`   Slug: ${tenant.slug}`);
    }
    console.log('');

    // 4. Comparar tenant_id
    if (usersByEmail.length > 0 && usersByTenant.length === 0) {
      console.log('⚠️  PROBLEMA DETECTADO:');
      console.log(`   Usuário existe, mas com tenant_id diferente!`);
      console.log(`   Tenant esperado: ${DEV_TENANT_ID}`);
      console.log(`   Tenant no banco: ${usersByEmail[0]!.tenantId}`);
      console.log(`   São iguais? ${usersByEmail[0]!.tenantId === DEV_TENANT_ID}`);
    } else if (usersByEmail.length === 0) {
      console.log('❌ PROBLEMA: Usuário não encontrado no banco!');
      console.log('   Execute: pnpm seed:dev');
    } else if (usersByTenant.length > 0) {
      console.log('✅ Usuário encontrado corretamente pela query do login!');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

verifyDevUser().catch(console.error);














