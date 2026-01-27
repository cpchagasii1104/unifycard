// backend/src/core/rbac/rbac.service.ts

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import type {
  Role,
  Permission,
  UserRole,
  RoleWithPermissions,
  UserWithRoles,
  PermissionString,
  PermissionCheck,
} from './rbac.types';

type RoleRow = {
  role_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: Date;
  updated_at: Date;
};

type PermissionRow = {
  permission_id: string;
  tenant_id: string;
  resource: string;
  action: string;
  description: string | null;
  is_system_permission: boolean;
  created_at: Date;
  updated_at: Date;
};

type UserRoleRow = {
  user_role_id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  assigned_at: Date;
  assigned_by: string | null;
};

class RBACService {
  // ===========================
  // CONVERSORES
  // ===========================

  private toRole(row: RoleRow): Role {
    return {
      roleId: row.role_id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      isSystemRole: row.is_system_role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toPermission(row: PermissionRow): Permission {
    return {
      permissionId: row.permission_id,
      tenantId: row.tenant_id,
      resource: row.resource,
      action: row.action,
      description: row.description,
      isSystemPermission: row.is_system_permission,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ===========================
  // VERIFICAÇÕES DE PERMISSÃO
  // ===========================

  /**
   * Verifica se um usuário tem uma permission específica
   */
  async userHasPermission(
    tenantId: string,
    userId: string,
    permission: PermissionString
  ): Promise<PermissionCheck> {
    const [resource, action] = permission.split(':');

    if (!resource || !action) {
      return {
        hasPermission: false,
        userId,
        permission,
        reason: 'Invalid permission format. Expected "resource:action"',
      };
    }

    const result = await runQueryWithTenant<{ has_permission: boolean }>(
      tenantId,
      'SELECT user_has_permission($1, $2, $3, $4) as has_permission',
      [tenantId, userId, resource, action]
    );

    return {
      hasPermission: result?.has_permission ?? false,
      userId,
      permission,
    };
  }

  /**
   * Verifica se usuário tem QUALQUER uma das permissions listadas
   */
  async userHasAnyPermission(
    tenantId: string,
    userId: string,
    permissions: PermissionString[]
  ): Promise<PermissionCheck> {
    for (const permission of permissions) {
      const check = await this.userHasPermission(tenantId, userId, permission);
      if (check.hasPermission) {
        return check;
      }
    }

    return {
      hasPermission: false,
      userId,
      permission: permissions.join(' OR ') as PermissionString,
      reason: `User does not have any of the required permissions: ${permissions.join(', ')}`,
    };
  }

  /**
   * Verifica se usuário tem TODAS as permissions listadas
   */
  async userHasAllPermissions(
    tenantId: string,
    userId: string,
    permissions: PermissionString[]
  ): Promise<PermissionCheck> {
    for (const permission of permissions) {
      const check = await this.userHasPermission(tenantId, userId, permission);
      if (!check.hasPermission) {
        return {
          hasPermission: false,
          userId,
          permission: permissions.join(' AND ') as PermissionString,
          reason: `User is missing required permission: ${permission}`,
        };
      }
    }

    return {
      hasPermission: true,
      userId,
      permission: permissions.join(' AND ') as PermissionString,
    };
  }

  /**
   * Busca todas as permissions de um usuário
   */
  async getUserPermissions(tenantId: string, userId: string): Promise<Permission[]> {
    const rows = await runQueriesWithTenant<PermissionRow>(
      tenantId,
      'SELECT * FROM get_user_permissions($1, $2)',
      [tenantId, userId]
    );

    return rows.map((row) => this.toPermission(row));
  }

  /**
   * Busca todas as roles de um usuário
   */
  async getUserRoles(tenantId: string, userId: string): Promise<Role[]> {
    const rows = await runQueriesWithTenant<RoleRow>(
      tenantId,
      `SELECT r.* 
       FROM roles r
       JOIN user_roles ur ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );

    return rows.map((row) => this.toRole(row));
  }

  /**
   * Busca user com suas roles e permissions
   */
  async getUserWithRoles(tenantId: string, userId: string): Promise<UserWithRoles> {
    const [roles, permissions] = await Promise.all([
      this.getUserRoles(tenantId, userId),
      this.getUserPermissions(tenantId, userId),
    ]);

    return {
      userId,
      roles,
      permissions,
    };
  }

  /**
   * Verifica se usuário tem uma role específica
   */
  async userHasRole(tenantId: string, userId: string, roleName: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      `SELECT EXISTS(
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = $1 AND r.name = $2
      ) as exists`,
      [userId, roleName]
    );

    return result?.exists ?? false;
  }

  /**
   * Verifica se usuário tem QUALQUER uma das roles listadas
   */
  async userHasAnyRole(
    tenantId: string,
    userId: string,
    roleNames: string[]
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ exists: boolean }>(
      tenantId,
      `SELECT EXISTS(
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = $1 AND r.name = ANY($2::text[])
      ) as exists`,
      [userId, roleNames]
    );

    return result?.exists ?? false;
  }

  // ===========================
  // ATRIBUIÇÃO DE ROLES
  // ===========================

  /**
   * Atribui uma role a um usuário
   */
  async assignRoleToUser(
    tenantId: string,
    userId: string,
    roleId: string,
    assignedBy?: string
  ): Promise<UserRole> {
    const row = await runQueryWithTenant<UserRoleRow>(
      tenantId,
      `INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE 
       SET assigned_at = now()
       RETURNING *`,
      [tenantId, userId, roleId, assignedBy]
    );

    if (!row) {
      throw new Error('Failed to assign role to user');
    }

    return {
      userRoleId: row.user_role_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      roleId: row.role_id,
      assignedAt: row.assigned_at,
      assignedBy: row.assigned_by,
    };
  }

  /**
   * Atribui uma role a um usuário (por nome da role)
   */
  async assignRoleByName(
    tenantId: string,
    userId: string,
    roleName: string,
    assignedBy?: string
  ): Promise<UserRole> {
    // Busca a role pelo nome
    const role = await runQueryWithTenant<RoleRow>(
      tenantId,
      'SELECT * FROM roles WHERE name = $1 LIMIT 1',
      [roleName]
    );

    if (!role) {
      const error = new Error(`Role not found: ${roleName}`);
      (error as any).statusCode = 404;
      throw error;
    }

    return this.assignRoleToUser(tenantId, userId, role.role_id, assignedBy);
  }

  /**
   * Remove uma role de um usuário
   */
  async removeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );
  }

  /**
   * Remove uma role de um usuário (por nome da role)
   */
  async removeRoleByName(tenantId: string, userId: string, roleName: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `DELETE FROM user_roles 
       WHERE user_id = $1 
       AND role_id = (SELECT role_id FROM roles WHERE name = $2 LIMIT 1)`,
      [userId, roleName]
    );
  }

  // ===========================
  // GESTÃO DE ROLES
  // ===========================

  /**
   * Busca role por ID
   */
  async getRoleById(tenantId: string, roleId: string): Promise<Role | null> {
    const row = await runQueryWithTenant<RoleRow>(
      tenantId,
      'SELECT * FROM roles WHERE role_id = $1 LIMIT 1',
      [roleId]
    );

    return row ? this.toRole(row) : null;
  }

  /**
   * Busca role por nome
   */
  async getRoleByName(tenantId: string, name: string): Promise<Role | null> {
    const row = await runQueryWithTenant<RoleRow>(
      tenantId,
      'SELECT * FROM roles WHERE name = $1 LIMIT 1',
      [name]
    );

    return row ? this.toRole(row) : null;
  }

  /**
   * Lista todas as roles
   */
  async listRoles(tenantId: string): Promise<Role[]> {
    const rows = await runQueriesWithTenant<RoleRow>(tenantId, 'SELECT * FROM roles ORDER BY name');

    return rows.map((row) => this.toRole(row));
  }

  /**
   * Busca role com suas permissions
   */
  async getRoleWithPermissions(tenantId: string, roleId: string): Promise<RoleWithPermissions | null> {
    const role = await this.getRoleById(tenantId, roleId);
    if (!role) return null;

    const permissions = await runQueriesWithTenant<PermissionRow>(
      tenantId,
      `SELECT p.* 
       FROM permissions p
       JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`,
      [roleId]
    );

    return {
      ...role,
      permissions: permissions.map((row) => this.toPermission(row)),
    };
  }

  // ===========================
  // BOOTSTRAP
  // ===========================

  /**
   * Inicializa RBAC padrão para um tenant
   * Cria roles e permissions padrão
   */
  async seedDefaultRBAC(tenantId: string): Promise<void> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('SELECT seed_default_rbac($1)', [tenantId]);
    } finally {
      client.release();
    }
  }
}

export const rbacService = new RBACService();