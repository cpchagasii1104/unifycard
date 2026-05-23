// src/scripts/seed-dev-tenant.ts
//
// Script de seed DEV para criar tenant de desenvolvimento
// APENAS para ambiente de desenvolvimento local
// NÃO executar em produção

import dotenv from 'dotenv';
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

// BLOQUEAR EM PRODUÇÃO
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERRO: Este script NÃO pode ser executado em produção');
  console.error('   NODE_ENV está definido como "production"');
  console.error('   Este seed é APENAS para ambiente de desenvolvimento local');
  process.exit(1);
}

// Configuração do tenant DEV
const DEV_TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_TENANT_NAME = 'UnifyCard DEV';
const DEV_TENANT_SLUG = 'unificard-dev';

/**
 * Verifica se tenant já existe
 */
async function tenantExists(tenantId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT id
        FROM tenants
        WHERE id = $1
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
 * Cria tenant de desenvolvimento
 */
async function createDevTenant(): Promise<void> {
  console.log('🚀 Seed DEV: Criando tenant de desenvolvimento...\n');

  // Verificar se já existe
  const exists = await tenantExists(DEV_TENANT_ID);
  if (exists) {
    console.log(`⚠️  Tenant DEV já existe (seed ignorado)`);
    console.log(`   Tenant ID: ${DEV_TENANT_ID}`);
    console.log(`   Name: ${DEV_TENANT_NAME}`);
    console.log(`   Slug: ${DEV_TENANT_SLUG}\n`);
    return;
  }

  await tenantService.createTenant({
    id: DEV_TENANT_ID,
    name: DEV_TENANT_NAME,
    slug: DEV_TENANT_SLUG,
  });

  console.log('✅ Tenant DEV criado com sucesso');
  console.log(`   Tenant ID: ${DEV_TENANT_ID}`);
  console.log(`   Name: ${DEV_TENANT_NAME}`);
  console.log(`   Slug: ${DEV_TENANT_SLUG}\n`);
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED DEV: Tenant de Desenvolvimento');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script é APENAS para desenvolvimento local');
  console.log('');

  try {
    await createDevTenant();
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














