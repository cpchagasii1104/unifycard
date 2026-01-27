// src/scripts/seed-dev-user.ts
//
// Script de seed DEV para criar usuário de desenvolvimento
// APENAS para ambiente de desenvolvimento local
// NÃO executar em produção

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database/pool';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  process.exit(1);
}

// BLOQUEAR EM PRODUÇÃO
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERRO: Este script NÃO pode ser executado em produção');
  console.error('   NODE_ENV está definido como "production"');
  console.error('   Este seed é APENAS para ambiente de desenvolvimento local');
  process.exit(1);
}

// Configuração do usuário DEV
const DEV_EMAIL = 'dev@unificard.local';
const DEV_PASSWORD = 'dev12345'; // Deve corresponder à senha padrão do frontend (Login.tsx)
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_TOKEN_VERSION = 0;

/**
 * Verifica se tenant existe
 */
async function tenantExists(tenantId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT tenant_id
        FROM tenants
        WHERE tenant_id = $1
        LIMIT 1
      `,
      [tenantId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}


/**
 * Busca usuário existente
 */
async function getExistingUser(tenantId: string, email: string): Promise<{ user_id: string; password_hash: string } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT user_id, password_hash
        FROM users
        WHERE tenant_id = $1 AND email = $2
        LIMIT 1
      `,
      [tenantId, email.toLowerCase()]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Cria ou atualiza usuário de desenvolvimento
 */
async function createOrUpdateDevUser(): Promise<void> {
  console.log('🚀 Seed DEV: Criando/atualizando usuário de desenvolvimento...\n');

  // Verificar se tenant existe
  const tenantExistsResult = await tenantExists(DEV_TENANT_ID);
  if (!tenantExistsResult) {
    console.error('❌ ERRO: Tenant DEV não encontrado');
    console.error(`   Tenant ID: ${DEV_TENANT_ID}`);
    console.error('   Execute seed:dev:tenant primeiro.\n');
    throw new Error('Tenant DEV não encontrado. Execute seed:dev:tenant primeiro.');
  }

  // Gerar hash bcrypt (sempre regenerar para garantir consistência)
  console.log('🔐 Gerando hash bcrypt da senha...');
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  console.log('✅ Hash gerado\n');

  // Verificar se usuário já existe
  const existingUser = await getExistingUser(DEV_TENANT_ID, DEV_EMAIL);
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_tenant = '${DEV_TENANT_ID}'`);

    if (existingUser) {
      // Atualizar usuário existente (garantir senha sempre correta e plan='pro')
      console.log('📝 Usuário já existe, atualizando senha e plano...');
      await client.query(
        `
          UPDATE users
          SET password_hash = $1,
              token_version = $2,
              plan = 'pro',
              is_test = true,
              updated_at = now()
          WHERE user_id = $3
        `,
        [passwordHash, DEV_TOKEN_VERSION, existingUser.user_id]
      );
      console.log('✅ Usuário atualizado com sucesso');
      console.log(`   User ID: ${existingUser.user_id}`);
      console.log(`   Plan: pro`);
    } else {
      // Criar novo usuário
      console.log('➕ Criando novo usuário...');
      const userId = uuidv4();
      await client.query(
        `
          INSERT INTO users (
            user_id,
            tenant_id,
            email,
            password_hash,
            token_version,
            plan,
            is_test,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, 'pro', true, now())
        `,
        [userId, DEV_TENANT_ID, DEV_EMAIL.toLowerCase(), passwordHash, DEV_TOKEN_VERSION]
      );
      console.log('✅ Usuário criado com sucesso');
      console.log(`   User ID: ${userId}`);
    }

    await client.query('COMMIT');

    // VERIFICAÇÃO AUTOMÁTICA: Buscar hash do banco e testar
    console.log('🔍 Verificando hash salvo no banco...');
    const savedHashResult = await client.query(
      `
        SELECT password_hash
        FROM users
        WHERE tenant_id = $1 AND email = $2
        LIMIT 1
      `,
      [DEV_TENANT_ID, DEV_EMAIL.toLowerCase()]
    );

    if (savedHashResult.rows.length === 0) {
      throw new Error('FALHA CRÍTICA: Usuário não encontrado após inserção/atualização');
    }

    const savedHash = savedHashResult.rows[0].password_hash;
    const verificationResult = await bcrypt.compare(DEV_PASSWORD, savedHash);
    
    if (!verificationResult) {
      throw new Error('FALHA CRÍTICA: Hash salvo no banco não passa na verificação bcrypt.compare');
    }

    console.log('✅ Hash verificado com sucesso (bcrypt.compare passou)');
    console.log(`   Email: ${DEV_EMAIL}`);
    console.log(`   Tenant: ${DEV_TENANT_ID}`);
    console.log(`   Token Version: ${DEV_TOKEN_VERSION}\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar/atualizar usuário:');
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED DEV: Usuário de Desenvolvimento');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script é APENAS para desenvolvimento local');
  console.log('');

  try {
    await createOrUpdateDevUser();
    console.log('✨ Seed DEV concluído com sucesso!');
  } catch (error) {
    console.error('\n💥 Erro fatal durante o seed DEV:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executa o script
main().catch((error) => {
  console.error('Erro não tratado:', error);
  process.exit(1);
});

