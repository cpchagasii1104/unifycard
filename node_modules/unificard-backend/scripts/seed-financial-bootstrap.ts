#!/usr/bin/env ts-node
/**
 * Bootstrap Financeiro
 * 
 * Cria conta platform_ops para um tenant se não existir.
 * 
 * REGRAS:
 * - Idempotente (pode rodar várias vezes sem duplicar)
 * - Não altera conta existente
 * - Cria apenas se não existir
 * 
 * USO:
 *   ts-node -r tsconfig-paths/register scripts/seed-financial-bootstrap.ts [tenant_id]
 * 
 * Se tenant_id não for fornecido, usa o primeiro tenant encontrado.
 */

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

interface TenantRow {
  tenant_id: string;
  name: string | null;
}

interface AccountRow {
  account_id: string;
  tenant_id: string;
  owner_id: string;
  owner_type: string;
  balance: string;
  currency: string;
  created_at: Date;
}

async function findTenant(tenantId?: string): Promise<string | null> {
  const { pool } = await import('@core/database/pool');
  const client = await pool.connect();
  try {
    if (tenantId) {
      // Verificar se tenant existe (sem tenant context)
      const result = await client.query<TenantRow>(
        'SELECT tenant_id, name FROM tenants WHERE tenant_id = $1 LIMIT 1',
        [tenantId]
      );
      return result.rows.length > 0 ? result.rows[0].tenant_id : null;
    }

    // Buscar primeiro tenant disponível
    const result = await client.query<TenantRow>(
      'SELECT tenant_id, name FROM tenants LIMIT 1'
    );
    return result.rows.length > 0 ? result.rows[0].tenant_id : null;
  } finally {
    client.release();
  }
}

async function checkPlatformOpsAccount(tenantId: string): Promise<AccountRow | null> {
  const account = await runQueryWithTenant<AccountRow>(
    tenantId,
    `SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
     FROM accounts
     WHERE tenant_id = $1 
       AND owner_type = 'platform_ops'
       AND currency = 'BRL'
     LIMIT 1`,
    [tenantId]
  );
  return account || null;
}

async function createPlatformOpsAccount(tenantId: string): Promise<AccountRow> {
  // owner_id = tenant_id para contas platform_ops
  const created = await runQueryWithTenant<AccountRow>(
    tenantId,
    `INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
     VALUES ($1, $2, 'platform_ops', 0, 'BRL')
     RETURNING account_id, tenant_id, owner_id, owner_type, balance, currency, created_at`,
    [tenantId, tenantId]
  );

  if (!created) {
    throw new Error('Failed to create platform_ops account');
  }

  return created;
}

async function main() {
  const tenantIdArg = process.argv[2];
  
  console.log('🌱 Bootstrap Financeiro - Criando conta platform_ops');
  console.log('');

  try {
    // 1. Encontrar tenant
    const tenantId = await findTenant(tenantIdArg);
    if (!tenantId) {
      console.error('❌ Erro: Nenhum tenant encontrado');
      if (tenantIdArg) {
        console.error(`   Tenant ID fornecido: ${tenantIdArg}`);
        console.error('   Verifique se o tenant existe no banco de dados.');
      } else {
        console.error('   Forneça um tenant_id ou crie um tenant primeiro.');
      }
      process.exit(1);
    }

    console.log(`✅ Tenant encontrado: ${tenantId}`);
    console.log('');

    // 2. Verificar se conta platform_ops já existe
    console.log('🔍 Verificando se conta platform_ops já existe...');
    const existingAccount = await checkPlatformOpsAccount(tenantId);

    if (existingAccount) {
      console.log('✅ Conta platform_ops já existe:');
      console.log(`   Account ID: ${existingAccount.account_id}`);
      console.log(`   Owner ID: ${existingAccount.owner_id}`);
      console.log(`   Balance: ${existingAccount.balance}`);
      console.log(`   Currency: ${existingAccount.currency}`);
      console.log(`   Created: ${existingAccount.created_at}`);
      console.log('');
      console.log('ℹ️  Bootstrap concluído (conta já existia)');
      process.exit(0);
    }

    // 3. Criar conta platform_ops
    console.log('📝 Criando conta platform_ops...');
    const account = await createPlatformOpsAccount(tenantId);

    console.log('✅ Conta platform_ops criada com sucesso:');
    console.log(`   Account ID: ${account.account_id}`);
    console.log(`   Owner ID: ${account.owner_id}`);
    console.log(`   Owner Type: ${account.owner_type}`);
    console.log(`   Balance: ${account.balance}`);
    console.log(`   Currency: ${account.currency}`);
    console.log(`   Created: ${account.created_at}`);
    console.log('');
    console.log('✅ Bootstrap concluído');

  } catch (error: any) {
    console.error('❌ Erro durante bootstrap:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

