// backend/src/core/tenants/tenant-context-permission.service.ts
// Service de permissões por (tenant, context)
// EXTENSÃO sobre core congelado - não altera estrutura de categorias

import { pool } from '@core/database/pool';
import type { CategoryContext } from '@unificard/contracts';

export type Permission = 'read' | 'write' | 'admin';

class TenantContextPermissionService {
  /**
   * Verifica se tenant tem permissão de leitura no context
   */
  async hasReadAccess(tenantId: string, context: CategoryContext): Promise<boolean> {
    const permission = await this.getPermission(tenantId, context);
    return permission === 'read' || permission === 'write' || permission === 'admin';
  }

  /**
   * Verifica se tenant tem permissão de escrita no context
   */
  async hasWriteAccess(tenantId: string, context: CategoryContext): Promise<boolean> {
    const permission = await this.getPermission(tenantId, context);
    return permission === 'write' || permission === 'admin';
  }

  /**
   * Verifica se tenant tem permissão de admin no context
   */
  async hasAdminAccess(tenantId: string, context: CategoryContext): Promise<boolean> {
    const permission = await this.getPermission(tenantId, context);
    return permission === 'admin';
  }

  /**
   * Obtém a permissão do tenant para o context
   * Retorna null se não houver permissão definida
   * 🔴 SCHEMA EXPLÍCITO: Usar public.tenant_contexts para garantir schema correto
   */
  private async getPermission(tenantId: string, context: CategoryContext): Promise<Permission | null> {
    const result = await pool.query<{ permission: Permission }>(
      `SELECT permission FROM public.tenant_contexts 
       WHERE tenant_id = $1 AND context = $2 
       LIMIT 1`,
      [tenantId, context]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].permission;
  }
}

export const tenantContextPermissionService = new TenantContextPermissionService();




