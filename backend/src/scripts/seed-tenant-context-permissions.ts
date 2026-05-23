// backend/src/scripts/seed-tenant-context-permissions.ts
//
// Script de seed para permissões iniciais de tenants por context
// Cria permissões para system-tenant e government tenant

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { SYSTEM_TENANT, ensureSystemTenant } from '../core/tenants/system-tenant';

// Carrega variáveis de ambiente
dotenv.config({ path: join(process.cwd(), '.env') });

// Valida se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ Erro: DATABASE_URL não está configurada no arquivo .env');
  process.exit(1);
}

// Lista canônica de contexts
const ALL_CONTEXTS = [
  'professional',
  'interest',
  'learning',
  'health',
  'education',
  'company',
  'economy',
  'person',
  'government',
  'infrastructure',
] as const;

// Government tenant ID (pode ser configurado via env ou usar um ID fixo)
const GOVERNMENT_TENANT_ID = process.env.GOVERNMENT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const GOVERNMENT_TENANT_NAME = 'Government Tenant';
const GOVERNMENT_TENANT_SLUG = 'government';

/**
 * Garante que um tenant existe
 */
async function ensureTenant(tenantId: string, name: string, slug: string): Promise<void> {
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM tenants WHERE id = $1 LIMIT 1',
    [tenantId]
  );

  if (result.rows.length === 0) {
    await tenantService.createTenant({
      id: tenantId,
      name,
      slug,
    });
    console.log(`✅ Tenant criado: ${name} (${tenantId})`);
  } else {
    console.log(`ℹ️  Tenant já existe: ${name} (${tenantId})`);
  }
}

/**
 * Garante que uma permissão existe
 */
async function ensurePermission(
  tenantId: string,
  context: string,
  permission: 'read' | 'write' | 'admin'
): Promise<void> {
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM tenant_contexts WHERE tenant_id = $1 AND context = $2 LIMIT 1',
    [tenantId, context]
  );

  if (result.rows.length === 0) {
    await pool.query(
      `INSERT INTO tenant_contexts (tenant_id, context, permission, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, context) DO UPDATE SET permission = EXCLUDED.permission`,
      [tenantId, context, permission]
    );
    console.log(`  ✅ Permissão criada: ${context} → ${permission}`);
  } else {
    // Atualizar permissão existente se necessário
    await pool.query(
      `UPDATE tenant_contexts SET permission = $3 
       WHERE tenant_id = $1 AND context = $2`,
      [tenantId, context, permission]
    );
    console.log(`  ℹ️  Permissão atualizada: ${context} → ${permission}`);
  }
}

/**
 * Seed para system-tenant: read em todos os contexts
 */
async function seedSystemTenant(): Promise<void> {
  console.log('\n📋 Seed: System Tenant');
  console.log('─'.repeat(50));
  
  await ensureSystemTenant();
  
  for (const context of ALL_CONTEXTS) {
    await ensurePermission(SYSTEM_TENANT.tenantId, context, 'read');
  }
  
  console.log('✅ System tenant: read em todos os contexts');
}

/**
 * Seed para government tenant: admin em government/infrastructure, read em professional/company
 */
async function seedGovernmentTenant(): Promise<void> {
  console.log('\n📋 Seed: Government Tenant');
  console.log('─'.repeat(50));
  
  await ensureTenant(GOVERNMENT_TENANT_ID, GOVERNMENT_TENANT_NAME, GOVERNMENT_TENANT_SLUG);
  
  // Admin em government e infrastructure
  await ensurePermission(GOVERNMENT_TENANT_ID, 'government', 'admin');
  await ensurePermission(GOVERNMENT_TENANT_ID, 'infrastructure', 'admin');
  
  // Read em professional e company
  await ensurePermission(GOVERNMENT_TENANT_ID, 'professional', 'read');
  await ensurePermission(GOVERNMENT_TENANT_ID, 'company', 'read');
  
  console.log('✅ Government tenant: admin em government/infrastructure, read em professional/company');
}

/**
 * Função principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED: Tenant Context Permissions');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    await seedSystemTenant();
    await seedGovernmentTenant();
    
    console.log('\n✨ Seed concluído com sucesso!');
  } catch (error) {
    console.error('\n💥 Erro fatal durante o seed:');
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




