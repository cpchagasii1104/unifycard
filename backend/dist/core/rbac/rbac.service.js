"use strict";
// backend/src/core/rbac/rbac.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacService = void 0;
const pool_1 = require("@core/database/pool");
class RBACService {
    // ===========================
    // CONVERSORES
    // ===========================
    toRole(row) {
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
    toPermission(row) {
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
    async userHasPermission(tenantId, userId, permission) {
        const [resource, action] = permission.split(':');
        if (!resource || !action) {
            return {
                hasPermission: false,
                userId,
                permission,
                reason: 'Invalid permission format. Expected "resource:action"',
            };
        }
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT user_has_permission($1, $2, $3, $4) as has_permission', [tenantId, userId, resource, action]);
        return {
            hasPermission: result?.has_permission ?? false,
            userId,
            permission,
        };
    }
    /**
     * Verifica se usuário tem QUALQUER uma das permissions listadas
     */
    async userHasAnyPermission(tenantId, userId, permissions) {
        for (const permission of permissions) {
            const check = await this.userHasPermission(tenantId, userId, permission);
            if (check.hasPermission) {
                return check;
            }
        }
        return {
            hasPermission: false,
            userId,
            permission: permissions.join(' OR '),
            reason: `User does not have any of the required permissions: ${permissions.join(', ')}`,
        };
    }
    /**
     * Verifica se usuário tem TODAS as permissions listadas
     */
    async userHasAllPermissions(tenantId, userId, permissions) {
        for (const permission of permissions) {
            const check = await this.userHasPermission(tenantId, userId, permission);
            if (!check.hasPermission) {
                return {
                    hasPermission: false,
                    userId,
                    permission: permissions.join(' AND '),
                    reason: `User is missing required permission: ${permission}`,
                };
            }
        }
        return {
            hasPermission: true,
            userId,
            permission: permissions.join(' AND '),
        };
    }
    /**
     * Busca todas as permissions de um usuário
     */
    async getUserPermissions(tenantId, userId) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, 'SELECT * FROM get_user_permissions($1, $2)', [tenantId, userId]);
        return rows.map((row) => this.toPermission(row));
    }
    /**
     * Busca todas as roles de um usuário
     */
    async getUserRoles(tenantId, userId) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `SELECT r.* 
       FROM roles r
       JOIN user_roles ur ON r.role_id = ur.role_id
       WHERE ur.user_id = $1`, [userId]);
        return rows.map((row) => this.toRole(row));
    }
    /**
     * Busca user com suas roles e permissions
     */
    async getUserWithRoles(tenantId, userId) {
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
    async userHasRole(tenantId, userId, roleName) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT EXISTS(
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = $1 AND r.name = $2
      ) as exists`, [userId, roleName]);
        return result?.exists ?? false;
    }
    /**
     * Verifica se usuário tem QUALQUER uma das roles listadas
     */
    async userHasAnyRole(tenantId, userId, roleNames) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT EXISTS(
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = $1 AND r.name = ANY($2::text[])
      ) as exists`, [userId, roleNames]);
        return result?.exists ?? false;
    }
    // ===========================
    // ATRIBUIÇÃO DE ROLES
    // ===========================
    /**
     * Atribui uma role a um usuário
     */
    async assignRoleToUser(tenantId, userId, roleId, assignedBy) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE 
       SET assigned_at = now()
       RETURNING *`, [tenantId, userId, roleId, assignedBy]);
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
    async assignRoleByName(tenantId, userId, roleName, assignedBy) {
        // Busca a role pelo nome
        const role = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE name = $1 LIMIT 1', [roleName]);
        if (!role) {
            const error = new Error(`Role not found: ${roleName}`);
            error.statusCode = 404;
            throw error;
        }
        return this.assignRoleToUser(tenantId, userId, role.role_id, assignedBy);
    }
    /**
     * Remove uma role de um usuário
     */
    async removeRoleFromUser(tenantId, userId, roleId) {
        await (0, pool_1.runQueryWithTenant)(tenantId, 'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
    }
    /**
     * Remove uma role de um usuário (por nome da role)
     */
    async removeRoleByName(tenantId, userId, roleName) {
        await (0, pool_1.runQueryWithTenant)(tenantId, `DELETE FROM user_roles 
       WHERE user_id = $1 
       AND role_id = (SELECT role_id FROM roles WHERE name = $2 LIMIT 1)`, [userId, roleName]);
    }
    // ===========================
    // GESTÃO DE ROLES
    // ===========================
    /**
     * Busca role por ID
     */
    async getRoleById(tenantId, roleId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE role_id = $1 LIMIT 1', [roleId]);
        return row ? this.toRole(row) : null;
    }
    /**
     * Busca role por nome
     */
    async getRoleByName(tenantId, name) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE name = $1 LIMIT 1', [name]);
        return row ? this.toRole(row) : null;
    }
    /**
     * Lista todas as roles
     */
    async listRoles(tenantId) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, 'SELECT * FROM roles ORDER BY name');
        return rows.map((row) => this.toRole(row));
    }
    /**
     * Busca role com suas permissions
     */
    async getRoleWithPermissions(tenantId, roleId) {
        const role = await this.getRoleById(tenantId, roleId);
        if (!role)
            return null;
        const permissions = await (0, pool_1.runQueriesWithTenant)(tenantId, `SELECT p.* 
       FROM permissions p
       JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.resource, p.action`, [roleId]);
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
    async seedDefaultRBAC(tenantId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            await client.query('SELECT seed_default_rbac($1)', [tenantId]);
        }
        finally {
            client.release();
        }
    }
}
exports.rbacService = new RBACService();
