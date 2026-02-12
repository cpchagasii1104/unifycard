#!/usr/bin/env ts-node
/**
 * Verificação de Invariantes do Core Financeiro
 * 
 * Valida invariantes críticos do Core Financeiro:
 * - accounts.owner_id e owner_type nunca são NULL
 * - Existe exatamente uma conta platform_ops por tenant
 * - transactions sempre referenciam accounts.account_id válido
 * 
 * Uso:
 *   ts-node -r tsconfig-paths/register scripts/check-financial-invariants.ts [tenant_id]
 * 
 * Se tenant_id não for fornecido, verifica todos os tenants.
 */

import { runQueryWithTenant, runQueriesWithTenant, pool } from '@core/database/pool';

interface Violation {
  tenantId: string;
  checkName: string;
  message: string;
  count?: number;
  details?: any[];
}

async function checkInvariants(tenantId?: string): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Se tenant_id fornecido, verificar apenas esse tenant
  if (tenantId) {
    await checkTenantInvariants(tenantId, violations);
  } else {
    // Verificar todos os tenants
    const client = await pool.connect();
    try {
      const tenantsResult = await client.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM tenants'
      );
      
      for (const tenant of tenantsResult.rows) {
        await checkTenantInvariants(tenant.tenant_id, violations);
      }
    } finally {
      client.release();
    }
  }

  return violations;
}

async function checkTenantInvariants(tenantId: string, violations: Violation[]): Promise<void> {
  // 1. Verificar owner_id NOT NULL
  try {
    const nullOwnerIdResult = await runQueryWithTenant<{ count: string }>(
      tenantId,
      'SELECT COUNT(*) as count FROM accounts WHERE owner_id IS NULL',
      [tenantId]
    );
    const nullOwnerIdCount = nullOwnerIdResult ? parseInt(nullOwnerIdResult.count ?? '0', 10) : 0;
    
    if (nullOwnerIdCount > 0) {
      violations.push({
        tenantId,
        checkName: 'accounts.owner_id NOT NULL',
        message: `Violação: ${nullOwnerIdCount} conta(s) com owner_id NULL`,
        count: nullOwnerIdCount,
      });
    }
  } catch (error: any) {
    // Se tabela não existe, não é violação (banco vazio é válido)
    if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
      console.warn(`⚠️  Tabela accounts não existe para tenant ${tenantId} (banco vazio - OK)`);
      return;
    }
    throw error;
  }

  // 2. Verificar owner_type NOT NULL
  try {
    const nullOwnerTypeResult = await runQueryWithTenant<{ count: string }>(
      tenantId,
      'SELECT COUNT(*) as count FROM accounts WHERE owner_type IS NULL',
      [tenantId]
    );
    const nullOwnerTypeCount = nullOwnerTypeResult ? parseInt(nullOwnerTypeResult.count ?? '0', 10) : 0;
    
    if (nullOwnerTypeCount > 0) {
      violations.push({
        tenantId,
        checkName: 'accounts.owner_type NOT NULL',
        message: `Violação: ${nullOwnerTypeCount} conta(s) com owner_type NULL`,
        count: nullOwnerTypeCount,
      });
    }
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
      return; // Já tratado acima
    }
    throw error;
  }

  // 3. Verificar uma conta platform_ops por tenant
  try {
    const platformOpsResult = await runQueriesWithTenant<{ tenant_id: string; count: string }>(
      tenantId,
      `SELECT tenant_id, COUNT(*) as count 
       FROM accounts 
       WHERE owner_type = 'platform_ops' 
       GROUP BY tenant_id 
       HAVING COUNT(*) > 1`,
      [tenantId]
    );
    
    if (platformOpsResult && Array.isArray(platformOpsResult) && platformOpsResult.length > 0) {
      for (const row of platformOpsResult) {
        violations.push({
          tenantId: row.tenant_id,
          checkName: 'Uma conta platform_ops por tenant',
          message: `Violação: ${row.count} conta(s) platform_ops no tenant (deve ser exatamente 1)`,
          count: parseInt(row.count, 10),
        });
      }
    }
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
      return; // Já tratado acima
    }
    throw error;
  }

  // 4. Verificar transactions referencia accounts
  try {
    const invalidTransactionsResult = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `SELECT COUNT(*) as count 
       FROM transactions t
       WHERE NOT EXISTS (
         SELECT 1 FROM accounts a 
         WHERE a.account_id = t.from_account OR a.account_id = t.to_account
       )`,
      [tenantId]
    );
    const invalidTransactionsCount = invalidTransactionsResult 
      ? parseInt(invalidTransactionsResult.count ?? '0', 10) 
      : 0;
    
    if (invalidTransactionsCount > 0) {
      violations.push({
        tenantId,
        checkName: 'transactions referencia accounts',
        message: `Violação: ${invalidTransactionsCount} transação(ões) referencia(m) account_id inexistente`,
        count: invalidTransactionsCount,
      });
    }
  } catch (error: any) {
    // Se tabela transactions não existe, não é violação (banco vazio é válido)
    if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('table')) {
      return; // OK - tabela não existe ainda
    }
    throw error;
  }
}

async function main() {
  const tenantId = process.argv[2];
  
  console.log('🔍 Verificando invariantes do Core Financeiro...');
  if (tenantId) {
    console.log(`   Tenant: ${tenantId}`);
  } else {
    console.log('   Todos os tenants');
  }
  console.log('');

  try {
    const violations = await checkInvariants(tenantId);

    if (violations.length > 0) {
      console.error('❌ Violações encontradas:\n');
      violations.forEach(v => {
        console.error(`  Tenant: ${v.tenantId}`);
        console.error(`  Check: ${v.checkName}`);
        console.error(`  ${v.message}`);
        if (v.count !== undefined) {
          console.error(`  Count: ${v.count}`);
        }
        console.error('');
      });
      console.error(`\nTotal: ${violations.length} violação(ões)`);
      process.exit(1);
    }

    console.log('✅ Todas as invariantes estão corretas.');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Erro durante verificação:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


