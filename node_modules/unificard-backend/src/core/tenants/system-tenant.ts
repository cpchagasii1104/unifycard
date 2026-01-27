// backend/src/core/tenants/system-tenant.ts
// Tenant canônico para uso em scripts e operações de sistema
// SSOT: Scripts NUNCA leem categorias sem tenant e context

import { pool } from '@core/database/pool';

export const SYSTEM_TENANT = {
  tenantId: 'system-tenant',
  countryCode: null as string | null,
} as const;

/**
 * Garante que o system-tenant existe no banco de dados
 * Usado por scripts que precisam ler categorias
 */
export async function ensureSystemTenant(): Promise<void> {
  const result = await pool.query<{ tenant_id: string }>(
    'SELECT tenant_id FROM tenants WHERE tenant_id = $1 LIMIT 1',
    [SYSTEM_TENANT.tenantId]
  );

  if (result.rows.length === 0) {
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug, created_at, updated_at)
       VALUES ($1, 'System Tenant', 'system-tenant', NOW(), NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [SYSTEM_TENANT.tenantId]
    );
  }
}

