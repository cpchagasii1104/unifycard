// scripts/staging/seed-staging.ts
// Seed mínimo obrigatório para staging
// 🔴 BLINDAGEM: Aborta se seed falhar

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { join } from 'path';

// Importar bcrypt (deve estar instalado no backend)
// Este script deve ser executado de dentro de backend/ ou com ts-node do backend
const bcrypt = require('bcrypt');

// Carregar .env
dotenv.config({ path: join(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const STAGING_PASSWORD = 'staging123';

const REQUIRED_ENV = ['DATABASE_URL', 'NODE_ENV', 'JWT_SECRET'];

function validateEnv() {
  const missing = REQUIRED_ENV.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV !== 'staging') {
    throw new Error(`NODE_ENV deve ser 'staging', atual: ${process.env.NODE_ENV}`);
  }

  if ((process.env.JWT_SECRET?.length || 0) < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
}

async function seedStaging() {
  console.log('==========================================');
  console.log('  STAGING SEED');
  console.log('==========================================');
  console.log('');

  // Validar ambiente
  console.log('[1/4] Validando ambiente...');
  validateEnv();
  console.log('✅ Ambiente válido');

  // Conectar ao banco
  console.log('[2/4] Conectando ao banco...');
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Conexão estabelecida');

    // Verificar se já existe tenant de staging
    console.log('[3/4] Verificando tenant de staging...');
    const tenantResult = await client.query(
      "SELECT tenant_id, name FROM tenants WHERE name = 'staging' LIMIT 1"
    );

    let tenantId: string;
    if (tenantResult.rows.length > 0) {
      tenantId = tenantResult.rows[0].tenant_id;
      console.log(`✅ Tenant de staging já existe: ${tenantId}`);
    } else {
      // Criar tenant de staging
      console.log('   Criando tenant de staging...');
      const newTenantResult = await client.query(
        `INSERT INTO tenants (name, status, metadata)
         VALUES ('staging', 'active', '{"environment": "staging"}'::jsonb)
         RETURNING tenant_id`
      );
      tenantId = newTenantResult.rows[0].tenant_id;
      console.log(`✅ Tenant de staging criado: ${tenantId}`);
    }

    // Verificar se já existe usuário de staging
    console.log('[4/4] Verificando usuário de staging...');
    const userResult = await client.query(
      `SELECT user_id, email FROM users 
       WHERE email = 'staging@unificard.local' 
       LIMIT 1`
    );

    if (userResult.rows.length > 0) {
      const existingUserId = userResult.rows[0].user_id;
      console.log(`✅ Usuário de staging já existe: ${existingUserId}`);
      
      // Atualizar senha para garantir que está correta
      console.log('   Atualizando senha para garantir consistência...');
      const passwordHash = await bcrypt.hash(STAGING_PASSWORD, 10);
      await client.query(
        `UPDATE users 
         SET password_hash = $1, updated_at = now()
         WHERE user_id = $2`,
        [passwordHash, existingUserId]
      );
      console.log('   ✅ Senha atualizada');
    } else {
      // Criar usuário de staging
      console.log('   Criando usuário de staging...');
      const passwordHash = await bcrypt.hash(STAGING_PASSWORD, 10);
      const newUserResult = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, status, metadata)
         VALUES ($1, 'staging@unificard.local', $2, 'active', '{"environment": "staging"}'::jsonb)
         RETURNING user_id, email`,
        [tenantId, passwordHash]
      );
      console.log(`✅ Usuário de staging criado: ${newUserResult.rows[0].email}`);
    }

    console.log('');
    console.log('==========================================');
    console.log('  ✅ SEED COMPLETO');
    console.log('==========================================');
    console.log('');
    console.log('Credenciais de staging:');
    console.log('  Email: staging@unificard.local');
    console.log('  Password: staging123');
    console.log('  Tenant: staging');
    console.log('');

  } finally {
    client.release();
  }
}

// Executar
seedStaging()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ ERRO no seed:', error.message);
    console.error(error);
    process.exit(1);
  });

