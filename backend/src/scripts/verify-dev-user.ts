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

async function verifyDevUser() {
  console.log('🔍 Verificando usuário DEV no banco...\n');

  const client = await pool.connect();
  try {
    // 1. Buscar sem filtro de tenant
    console.log('1️⃣ Buscando usuário por email (sem filtro de tenant):');
    const result1 = await client.query(
      `SELECT user_id, tenant_id, email, token_version FROM users WHERE email = $1`,
      [DEV_EMAIL.toLowerCase()]
    );
    console.log(`   Encontrados: ${result1.rows.length} usuário(s)`);
    result1.rows.forEach((row, i) => {
      console.log(`   [${i + 1}] User ID: ${row.user_id}`);
      console.log(`       Tenant ID: ${row.tenant_id}`);
      console.log(`       Email: ${row.email}`);
      console.log(`       Token Version: ${row.token_version}`);
    });
    console.log('');

    // 2. Buscar com filtro de tenant
    console.log('2️⃣ Buscando usuário por tenant_id E email (query do login):');
    const result2 = await client.query(
      `SELECT user_id, tenant_id, email, token_version FROM users WHERE tenant_id = $1 AND email = $2`,
      [DEV_TENANT_ID, DEV_EMAIL.toLowerCase()]
    );
    console.log(`   Encontrados: ${result2.rows.length} usuário(s)`);
    result2.rows.forEach((row, i) => {
      console.log(`   [${i + 1}] User ID: ${row.user_id}`);
      console.log(`       Tenant ID: ${row.tenant_id}`);
      console.log(`       Email: ${row.email}`);
      console.log(`       Token Version: ${row.token_version}`);
    });
    console.log('');

    // 3. Verificar tenant
    console.log('3️⃣ Verificando se tenant existe:');
    const tenantResult = await client.query(
      `SELECT tenant_id, name, slug FROM tenants WHERE tenant_id = $1`,
      [DEV_TENANT_ID]
    );
    console.log(`   Tenant encontrado: ${tenantResult.rows.length > 0 ? 'SIM' : 'NÃO'}`);
    if (tenantResult.rows.length > 0) {
      console.log(`   Name: ${tenantResult.rows[0].name}`);
      console.log(`   Slug: ${tenantResult.rows[0].slug}`);
    }
    console.log('');

    // 4. Comparar tenant_id
    if (result1.rows.length > 0 && result2.rows.length === 0) {
      console.log('⚠️  PROBLEMA DETECTADO:');
      console.log(`   Usuário existe, mas com tenant_id diferente!`);
      console.log(`   Tenant esperado: ${DEV_TENANT_ID}`);
      console.log(`   Tenant no banco: ${result1.rows[0].tenant_id}`);
      console.log(`   São iguais? ${result1.rows[0].tenant_id === DEV_TENANT_ID}`);
    } else if (result1.rows.length === 0) {
      console.log('❌ PROBLEMA: Usuário não encontrado no banco!');
      console.log('   Execute: pnpm seed:dev');
    } else if (result2.rows.length > 0) {
      console.log('✅ Usuário encontrado corretamente pela query do login!');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

verifyDevUser().catch(console.error);














