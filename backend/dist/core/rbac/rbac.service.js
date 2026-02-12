"use strict";
// backend/src/core/rbac/rbac.service.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
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
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    // ===========================
    // VERIFICAÇÕES DE PERMISSÃO V2 (ACTORID + INTENT + SCOPE)
    // ===========================
    /**
     * Verifica se um actor tem uma permission específica para um intent e scope
     * Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
     *
     * RBAC V2 NÃO converte actorId → userId.
     * RBAC V2 decide EXCLUSIVAMENTE com actorId + intent + scope.
     */
    async actorHasPermission(tenantId, actorId, intent, scope, permission) {
        const [resource, action] = permission.split(':');
        if (!resource || !action) {
            return {
                hasPermission: false,
                actorId,
                permission,
                reason: 'Invalid permission format. Expected "resource:action"',
            };
        }
        // Verificar se actor existe (consulta permitida, mas não participa da decisão)
        const actorExists = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT EXISTS(SELECT 1 FROM actors WHERE actor_id = $1 AND tenant_id = $2) as exists', [actorId, tenantId]);
        if (!actorExists?.exists) {
            return {
                hasPermission: false,
                actorId,
                permission,
                reason: `Actor not found: ${actorId}`,
            };
        }
        // Decisão RBAC V2: consultar permissões diretamente pelo actorId
        // Conforme RBAC_V2_CONTRACT.md: decide apenas com actorId + intent + scope
        // NOTA: Função SQL encapsula mapeamento actor_id → permissões sem expor user_id
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT actor_has_permission($1, $2, $3, $4) as has_permission`, [tenantId, actorId, resource, action]);
        return {
            hasPermission: result?.has_permission ?? false,
            actorId,
            permission,
        };
    }
    /**
     * Verifica se um actor tem QUALQUER uma das permissions listadas para um intent e scope
     * Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
     */
    async actorHasAnyPermission(tenantId, actorId, intent, scope, permissions) {
        for (const permission of permissions) {
            const check = await this.actorHasPermission(tenantId, actorId, intent, scope, permission);
            if (check.hasPermission) {
                return check;
            }
        }
        return {
            hasPermission: false,
            actorId,
            permission: permissions.join(' OR '),
            reason: `Actor does not have any of the required permissions: ${permissions.join(', ')} for intent "${intent}" in scope "${scope}"`,
        };
    }
    /**
     * Verifica se um actor tem TODAS as permissions listadas para um intent e scope
     * Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
     */
    async actorHasAllPermissions(tenantId, actorId, intent, scope, permissions) {
        for (const permission of permissions) {
            const check = await this.actorHasPermission(tenantId, actorId, intent, scope, permission);
            if (!check.hasPermission) {
                return {
                    hasPermission: false,
                    actorId,
                    permission: permissions.join(' AND '),
                    reason: `Actor is missing required permission: ${permission} for intent "${intent}" in scope "${scope}"`,
                };
            }
        }
        return {
            hasPermission: true,
            actorId,
            permission: permissions.join(' AND '),
        };
    }
    /**
     * Verifica se um actor tem QUALQUER uma das roles listadas para um intent e scope
     * Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
     *
     * RBAC V2 NÃO converte actorId → userId.
     * RBAC V2 decide EXCLUSIVAMENTE com actorId + intent + scope.
     */
    async actorHasAnyRole(tenantId, actorId, intent, scope, roleNames) {
        // Decisão RBAC V2: consultar roles diretamente pelo actorId
        // Conforme RBAC_V2_CONTRACT.md: decide apenas com actorId + intent + scope
        // NOTA: Função SQL encapsula mapeamento actor_id → roles sem expor user_id
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT actor_has_any_role($1, $2, $3::text[]) as exists`, [tenantId, actorId, roleNames]);
        return result?.exists ?? false;
    }
    // ===========================
    // VERIFICAÇÕES DE PERMISSÃO (LEGADO - DEPRECATED)
    // ===========================
    /**
     * Verifica se um usuário tem uma permission específica
     * @deprecated Use actorHasPermission instead. Conforme RBAC_V2_CONTRACT.md
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
            userId, // Deprecated
            permission,
        };
    }
    /**
     * Verifica se usuário tem QUALQUER uma das permissions listadas
     * @deprecated Use actorHasAnyPermission instead. Conforme RBAC_V2_CONTRACT.md
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
            userId, // Deprecated
            permission: permissions.join(' OR '),
            reason: `User does not have any of the required permissions: ${permissions.join(', ')}`,
        };
    }
    /**
     * Verifica se usuário tem TODAS as permissions listadas
     * @deprecated Use actorHasAllPermissions instead. Conforme RBAC_V2_CONTRACT.md
     */
    async userHasAllPermissions(tenantId, userId, permissions) {
        for (const permission of permissions) {
            const check = await this.userHasPermission(tenantId, userId, permission);
            if (!check.hasPermission) {
                return {
                    hasPermission: false,
                    userId, // Deprecated
                    permission: permissions.join(' AND '),
                    reason: `User is missing required permission: ${permission}`,
                };
            }
        }
        return {
            hasPermission: true,
            userId, // Deprecated
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
     * @deprecated Use actorHasAnyRole instead. Conforme RBAC_V2_CONTRACT.md
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
        // 🔀 SOFT-BLOCK (Fase 3): Logar atribuição de role (LOG ONLY, não bloqueia)
        // Buscar nome da role para verificar se é role de poder
        const role = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT * FROM roles WHERE role_id = $1 LIMIT 1', [roleId]);
        if (role && role.length > 0) {
            const { softBlockService } = await Promise.resolve().then(() => __importStar(require('@core/authorization/soft-block.service')));
            softBlockService.logRbacRoleAssignment(roleId, role[0].name, {
                tenantId,
                userId,
                requestId: undefined, // TODO: extrair de request se disponível
            });
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `INSERT INTO user_roles (tenant_id, user_id, role_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE 
       SET assignedAt = now()
       RETURNING *`, [tenantId, userId, roleId, assignedBy]);
        if (!row) {
            throw new Error('Failed to assign role to user');
        }
        return {
            userRoleId: row.user_role_id,
            tenantId: row.tenant_id,
            userId: row.user_id,
            roleId: row.role_id,
            assignedAt: row.assignedAt,
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
