// src/scripts/seed-dev-actor.ts
//
// Script de seed DEV para criar actor de usuário de desenvolvimento
// APENAS para ambiente de desenvolvimento local
// NÃO executar em produção

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { identityService } from '../core/identity/identity.service';
import { actorRepository } from '../modules/social/actor.repository';
import 'tsconfig-paths/register';

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
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';

/**
 * Busca usuário DEV
 */
async function getDevUser(): Promise<{ user_id: string; email: string } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT user_id, email
        FROM users
        WHERE tenant_id = $1 AND email = $2
        LIMIT 1
      `,
      [DEV_TENANT_ID, DEV_EMAIL.toLowerCase()]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Verifica se actor já existe para o usuário
 */
async function actorExists(tenantId: string, userId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT actor_id
        FROM actors
        WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
        LIMIT 1
      `,
      [tenantId, userId]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Cria identidade global e actor para usuário DEV
 */
async function createDevActor(): Promise<void> {
  console.log('🚀 Seed DEV: Criando actor de usuário de desenvolvimento...\n');

  // 1. Buscar usuário DEV
  const user = await getDevUser();
  if (!user) {
    console.error('❌ ERRO: Usuário DEV não encontrado');
    console.error(`   Email: ${DEV_EMAIL}`);
    console.error(`   Tenant: ${DEV_TENANT_ID}`);
    console.error('   Execute seed:dev:user primeiro.\n');
    throw new Error('Usuário DEV não encontrado. Execute seed:dev:user primeiro.');
  }

  console.log(`✅ Usuário DEV encontrado: ${user.user_id}\n`);

  // 2. Verificar se actor já existe
  const exists = await actorExists(DEV_TENANT_ID, user.user_id);
  if (exists) {
    console.log(`⚠️  Actor já existe para este usuário (seed ignorado)`);
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Tenant: ${DEV_TENANT_ID}\n`);
    return;
  }

  // 3. Criar identidade global se não existir
  console.log('🌐 Criando/verificando identidade global...');
  let globalUser;
  try {
    globalUser = await identityService.createGlobalIdentityForUser(user.user_id, DEV_TENANT_ID);
    console.log(`✅ Identidade global: ${globalUser.globalUserId}\n`);
  } catch (error) {
    console.error('❌ Erro ao criar identidade global:');
    console.error(error);
    throw error;
  }

  // 4. Criar actor
  console.log('👤 Criando actor de usuário...');
  try {
    const actor = await actorRepository.findOrCreateUserActor(
      DEV_TENANT_ID,
      user.user_id
    );
    console.log('✅ Actor criado com sucesso');
    console.log(`   Actor ID: ${actor.actor_id}`);
    console.log(`   Actor Type: ${actor.actor_type}`);
    console.log(`   Display Name: ${actor.display_name}`);
    console.log(`   User ID: ${actor.user_id}`);
    console.log(`   Tenant: ${DEV_TENANT_ID}\n`);
  } catch (error) {
    console.error('❌ Erro ao criar actor:');
    console.error(error);
    throw error;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED DEV: Actor de Usuário de Desenvolvimento');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script é APENAS para desenvolvimento local');
  console.log('');

  try {
    await createDevActor();
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

