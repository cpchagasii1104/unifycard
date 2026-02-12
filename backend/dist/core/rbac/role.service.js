"use strict";
// backend/src/core/rbac/role.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleService = void 0;
const pool_1 = require("@core/database/pool");
class RoleService {
    toRole(row) {
        return {
            roleId: row.role_id,
            tenantId: row.tenant_id,
            name: row.name,
            description: row.description,
            isSystemRole: row.is_system_role,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    /**
     * Cria uma nova role
     */
    async createRole(tenantId, input) {
        const { name, description } = input;
        // Verifica se já existe role com esse nome
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE name = $1 LIMIT 1', [name]);
        if (existing) {
            const error = new Error('Role with this name already exists');
            error.statusCode = 409;
            throw error;
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `INSERT INTO roles (tenant_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`, [tenantId, name, description || null]);
        if (!row) {
            throw new Error('Failed to create role');
        }
        return this.toRole(row);
    }
    /**
     * Busca role por ID
     */
    async getRoleById(tenantId, roleId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE role_id = $1 LIMIT 1', [roleId]);
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
     * Atualiza uma role
     */
    async updateRole(tenantId, roleId, input) {
        const { name, description } = input;
        // Verifica se a role existe
        const existing = await this.getRoleById(tenantId, roleId);
        if (!existing) {
            const error = new Error('Role not found');
            error.statusCode = 404;
            throw error;
        }
        // Não permite editar roles de sistema
        if (existing.isSystemRole) {
            const error = new Error('Cannot modify system role');
            error.statusCode = 403;
            throw error;
        }
        // Se está tentando mudar o nome, verifica se já existe outro com esse nome
        if (name && name !== existing.name) {
            const duplicate = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE name = $1 AND role_id != $2 LIMIT 1', [name, roleId]);
            if (duplicate) {
                const error = new Error('Role with this name already exists');
                error.statusCode = 409;
                throw error;
            }
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `UPDATE roles 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updatedAt = now()
       WHERE role_id = $3
       RETURNING *`, [name || null, description !== undefined ? description : null, roleId]);
        if (!row) {
            throw new Error('Failed to update role');
        }
        return this.toRole(row);
    }
    /**
     * Deleta uma role
     */
    async deleteRole(tenantId, roleId) {
        // Verifica se a role existe
        const existing = await this.getRoleById(tenantId, roleId);
        if (!existing) {
            const error = new Error('Role not found');
            error.statusCode = 404;
            throw error;
        }
        // Não permite deletar roles de sistema
        if (existing.isSystemRole) {
            const error = new Error('Cannot delete system role');
            error.statusCode = 403;
            throw error;
        }
        // Deleta a role (CASCADE vai remover user_roles e role_permissions automaticamente)
        await (0, pool_1.runQueryWithTenant)(tenantId, 'DELETE FROM roles WHERE role_id = $1', [roleId]);
    }
}
exports.roleService = new RoleService();
