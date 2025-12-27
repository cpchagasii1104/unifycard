"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/plugins/rbac.plugin.ts
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const rbac_service_1 = require("@core/rbac/rbac.service");
/**
 * RBAC Plugin
 *
 * Fornece decorators para autorização em rotas:
 *  - requirePermission: usuário precisa de TODAS as permissions
 *  - requireAnyPermission: usuário precisa de pelo menos UMA permission
 *  - requireRole: usuário precisa de pelo menos UMA role
 */
const rbacPlugin = async (fastify) => {
    // Decorator: requirePermission (TODAS)
    fastify.decorate('requirePermission', (permissions) => {
        return async (req, reply) => {
            const tenantId = req.tenant?.id;
            const userId = req.user?.id;
            if (!tenantId || !userId) {
                throw fastify.httpErrors.unauthorized('Authentication required');
            }
            const check = await rbac_service_1.rbacService.userHasAllPermissions(tenantId, userId, permissions);
            if (!check.hasPermission) {
                throw fastify.httpErrors.forbidden(check.reason || `Requires permissions: ${permissions.join(', ')}`);
            }
        };
    });
    // Decorator: requireAnyPermission (QUALQUER UMA)
    fastify.decorate('requireAnyPermission', (permissions) => {
        return async (req, reply) => {
            const tenantId = req.tenant?.id;
            const userId = req.user?.id;
            if (!tenantId || !userId) {
                throw fastify.httpErrors.unauthorized('Authentication required');
            }
            const check = await rbac_service_1.rbacService.userHasAnyPermission(tenantId, userId, permissions);
            if (!check.hasPermission) {
                throw fastify.httpErrors.forbidden(check.reason || `Requires at least one of: ${permissions.join(', ')}`);
            }
        };
    });
    // Decorator: requireRole (QUALQUER UMA)
    fastify.decorate('requireRole', (roles) => {
        return async (req, reply) => {
            const tenantId = req.tenant?.id;
            const userId = req.user?.id;
            if (!tenantId || !userId) {
                throw fastify.httpErrors.unauthorized('Authentication required');
            }
            const hasRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, userId, roles);
            if (!hasRole) {
                throw fastify.httpErrors.forbidden(`Requires one of roles: ${roles.join(', ')}`);
            }
        };
    });
};
exports.default = (0, fastify_plugin_1.default)(rbacPlugin, {
    name: 'rbac-plugin',
    dependencies: ['tenant-plugin', 'auth-plugin'],
});
//# sourceMappingURL=rbac.plugin.js.map