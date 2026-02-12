// backend/src/modules/organization/organization-role.repository.ts
// SPRINT 78: Repository para organization_roles

import { runQueriesWithTenant } from '@core/database/pool';
import type { OrganizationRole } from './organization.types';

interface OrganizationRoleRow {
  id: string;
  tenant_id: string;
  role_key: string;
  description: string | null;
  createdAt: Date;
}

class OrganizationRoleRepository {
  private toRole(row: OrganizationRoleRow): OrganizationRole {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      roleKey: row.role_key as any,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listRoles(tenantId: string): Promise<OrganizationRole[]> {
    const rows = await runQueriesWithTenant<OrganizationRoleRow>(
      tenantId,
      `
      SELECT id, tenant_id, role_key, description, createdAt
      FROM organization_roles
      WHERE tenant_id = $1
      ORDER BY role_key ASC
      `,
      [tenantId]
    );

    return rows.map((row) => this.toRole(row));
  }

  async getRoleByKey(tenantId: string, roleKey: string): Promise<OrganizationRole | null> {
    const rows = await runQueriesWithTenant<OrganizationRoleRow>(
      tenantId,
      `
      SELECT id, tenant_id, role_key, description, createdAt
      FROM organization_roles
      WHERE tenant_id = $1 AND role_key = $2
      `,
      [tenantId, roleKey]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toRole(rows[0]);
  }

  async getRoleById(tenantId: string, roleId: string): Promise<OrganizationRole | null> {
    const rows = await runQueriesWithTenant<OrganizationRoleRow>(
      tenantId,
      `
      SELECT id, tenant_id, role_key, description, createdAt
      FROM organization_roles
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, roleId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toRole(rows[0]);
  }
}

export const organizationRoleRepository = new OrganizationRoleRepository();







