// backend/src/core/tenants/system-tenant.ts
// Tenant canônico para uso em scripts e operações de sistema
// SSOT: Scripts NUNCA leem categorias sem tenant e context
//
// Coluna PK em `tenants` é `id` (UUID); slug canônico: system-tenant

import { pool } from '@core/database/pool';
import { tenantService } from './tenant.service';

/** UUID fixo do tenant de sistema (alinhado a `tenants.id`). */
export const SYSTEM_TENANT_ID = 'a0000001-0000-4000-8000-000000000001' as const;

export const SYSTEM_TENANT = {
  /** Mesmo valor que `tenants.id` para o slug `system-tenant`. */
  tenantId: SYSTEM_TENANT_ID,
  countryCode: null as string | null,
  slug: 'system-tenant' as const,
} as const;

/**
 * Garante que o system-tenant existe no banco de dados
 * Usado por scripts que precisam ler categorias
 */
export async function ensureSystemTenant(): Promise<void> {
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM tenants WHERE id = $1 OR slug = $2 LIMIT 1',
    [SYSTEM_TENANT_ID, SYSTEM_TENANT.slug]
  );

  if (existing.rows.length > 0) {
    return;
  }

  await tenantService.createTenant({
    id: SYSTEM_TENANT_ID,
    name: 'System Tenant',
    slug: SYSTEM_TENANT.slug,
  });
}
