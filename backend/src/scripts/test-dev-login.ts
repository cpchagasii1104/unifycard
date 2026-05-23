// src/scripts/test-dev-login.ts
//
// Script de teste para verificar se o login DEV funciona

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const DEV_EMAIL = 'dev@unificard.local';
const DEV_PASSWORD = 'dev12345'; // Deve corresponder à senha padrão do frontend
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';

type UserAuthRow = {
  user_id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  token_version: number;
};

type UserAuthRecord = {
  userId: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  tokenVersion: number;
};

// boundary: DB -> domain mapping
function mapUserAuthRowToDomain(row: UserAuthRow): UserAuthRecord {
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    passwordHash: row.password_hash,
    tokenVersion: row.token_version,
  };
}

async function testLogin() {
  console.log('🧪 Testando login DEV...\n');

  const client = await pool.connect();
  try {
    // 1. Buscar usuário
    console.log('1️⃣ Buscando usuário no banco...');
    const result = await client.query<UserAuthRow>(
      `
        SELECT user_id, tenant_id, email, password_hash, token_version
        FROM users
        WHERE tenant_id = $1 AND email = $2
        LIMIT 1
      `,
      [DEV_TENANT_ID, DEV_EMAIL.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    const user = mapUserAuthRowToDomain(result.rows[0]!);
    console.log('✅ Usuário encontrado:');
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Tenant ID: ${user.tenantId}`);
    console.log(`   Password Hash (primeiros 50 chars): ${user.passwordHash.substring(0, 50)}...`);
    console.log(`   Password Hash (tamanho): ${user.passwordHash.length}`);
    console.log(`   Token Version: ${user.tokenVersion}`);
    console.log('');

    // 2. Testar bcrypt.compare
    console.log('2️⃣ Testando bcrypt.compare...');
    console.log(`   Senha plaintext: "${DEV_PASSWORD}"`);
    console.log(`   Hash do banco: ${user.passwordHash.substring(0, 30)}...`);
    
    const match = await bcrypt.compare(DEV_PASSWORD, user.passwordHash);
    console.log(`   Resultado: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    console.log('');

    // 3. Gerar novo hash e comparar
    console.log('3️⃣ Gerando novo hash para comparação...');
    const newHash = await bcrypt.hash(DEV_PASSWORD, 10);
    console.log(`   Novo hash: ${newHash.substring(0, 30)}...`);
    const newMatch = await bcrypt.compare(DEV_PASSWORD, newHash);
    console.log(`   Novo hash funciona? ${newMatch ? '✅ SIM' : '❌ NÃO'}`);
    console.log('');

    // 4. Comparar hashes diretamente
    console.log('4️⃣ Comparando hashes diretamente...');
    console.log(`   Hash do banco === Novo hash? ${user.passwordHash === newHash ? 'SIM' : 'NÃO (esperado - bcrypt gera hashes diferentes)'}`);
    console.log('');

    // 5. Testar com diferentes variações da senha
    console.log('5️⃣ Testando variações da senha...');
    const variations = [
      DEV_PASSWORD,
      DEV_PASSWORD + ' ',
      ' ' + DEV_PASSWORD,
      DEV_PASSWORD.trim(),
    ];
    
    for (const variant of variations) {
      const variantMatch = await bcrypt.compare(variant, user.passwordHash);
      console.log(`   "${variant}" → ${variantMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

testLogin().catch(console.error);

