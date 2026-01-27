"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacPlugin = void 0;
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
 *
 * 🔴 GARANTIAS CANÔNICAS:
 * - RBAC NUNCA roda em escopo público (apenas em protectedScope)
 * - RBAC exige tenant válido (req.tenant.id)
 * - RBAC exige user válido (req.user.id)
 * - RBAC exige actionContext válido (req.actionContext.actingActorId)
 * - Ordem obrigatória: auth → tenant → action-context → rbac
 * - Nenhum fallback silencioso - falhas são explícitas
 */
const rbacPluginImpl = async (fastify) => {
    /**
     * 🔴 GUARD CANÔNICO: Validação explícita de contexto completo antes de qualquer autorização
     * Ordem obrigatória: tenant → user → actionContext (actor)
     * Nenhuma autorização parcial ou implícita é permitida
     */
    function validateRBACContext(req, reply, operation) {
        // GUARD 1: Tenant obrigatório
        if (!req.tenant || !req.tenant.id) {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                reason: 'Tenant ausente no RBAC',
            }, '❌ [RBAC] Falha: Tenant ausente');
            throw fastify.httpErrors.unauthorized('RBAC_INVARIANT_VIOLATION: Tenant is required for authorization');
        }
        // GUARD 2: User obrigatório
        if (!req.user || !req.user.id) {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                reason: 'User ausente no RBAC',
            }, '❌ [RBAC] Falha: User ausente');
            throw fastify.httpErrors.unauthorized('RBAC_INVARIANT_VIOLATION: User is required for authorization');
        }
        // GUARD 3: ActionContext (actor) obrigatório
        // ActionContext é resolvido pelo action-context-plugin ANTES do RBAC
        if (!req.actionContext || !req.actionContext.actingActorId) {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                userId: req.user.id,
                reason: 'ActionContext (actor) ausente no RBAC',
            }, '❌ [RBAC] Falha: ActionContext ausente');
            throw fastify.httpErrors.badRequest('RBAC_INVARIANT_VIOLATION: ActionContext (actor) is required for authorization. Ensure action-context-plugin runs before RBAC.');
        }
        // GUARD 4: Verificar coerência tenant × actor
        // (action-context-plugin já valida isso, mas garantia explícita para clareza arquitetural)
        if (req.actionContext.actingUserId !== req.user.id) {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                userId: req.user.id,
                actingUserId: req.actionContext.actingUserId,
                reason: 'Incoerência: actingUserId !== req.user.id',
            }, '❌ [RBAC] Falha: Incoerência user × actionContext');
            throw fastify.httpErrors.badRequest('RBAC_INVARIANT_VIOLATION: ActionContext actingUserId must match req.user.id');
        }
    }
    // Decorator: requirePermission (TODAS)
    fastify.decorate('requirePermission', (permissions) => {
        return async (req, reply) => {
            // 🔴 VALIDAÇÃO CANÔNICA: Contexto completo obrigatório
            validateRBACContext(req, reply, 'requirePermission');
            const tenantId = req.tenant.id;
            const userId = req.user.id;
            const actorId = req.actionContext.actingActorId;
            fastify.log.debug({
                route: req.url,
                method: req.method,
                tenantId,
                userId,
                actorId,
                permissions,
            }, '[RBAC] Verificando requirePermission');
            const check = await rbac_service_1.rbacService.userHasAllPermissions(tenantId, userId, permissions);
            if (!check.hasPermission) {
                fastify.log.warn({
                    route: req.url,
                    method: req.method,
                    tenantId,
                    userId,
                    actorId,
                    permissions,
                    reason: check.reason,
                }, '[RBAC] Permissão negada: requirePermission');
                throw fastify.httpErrors.forbidden(check.reason || `Requires permissions: ${permissions.join(', ')}`);
            }
        };
    });
    // Decorator: requireAnyPermission (QUALQUER UMA)
    fastify.decorate('requireAnyPermission', (permissions) => {
        return async (req, reply) => {
            // 🔴 VALIDAÇÃO CANÔNICA: Contexto completo obrigatório
            validateRBACContext(req, reply, 'requireAnyPermission');
            const tenantId = req.tenant.id;
            const userId = req.user.id;
            const actorId = req.actionContext.actingActorId;
            fastify.log.debug({
                route: req.url,
                method: req.method,
                tenantId,
                userId,
                actorId,
                permissions,
            }, '[RBAC] Verificando requireAnyPermission');
            const check = await rbac_service_1.rbacService.userHasAnyPermission(tenantId, userId, permissions);
            if (!check.hasPermission) {
                fastify.log.warn({
                    route: req.url,
                    method: req.method,
                    tenantId,
                    userId,
                    actorId,
                    permissions,
                    reason: check.reason,
                }, '[RBAC] Permissão negada: requireAnyPermission');
                throw fastify.httpErrors.forbidden(check.reason || `Requires at least one of: ${permissions.join(', ')}`);
            }
        };
    });
    // Decorator: requireRole (QUALQUER UMA)
    fastify.decorate('requireRole', (roles) => {
        return async (req, reply) => {
            // 🔴 VALIDAÇÃO CANÔNICA: Contexto completo obrigatório
            validateRBACContext(req, reply, 'requireRole');
            const tenantId = req.tenant.id;
            const userId = req.user.id;
            const actorId = req.actionContext.actingActorId;
            fastify.log.debug({
                route: req.url,
                method: req.method,
                tenantId,
                userId,
                actorId,
                roles,
            }, '[RBAC] Verificando requireRole');
            const hasRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, userId, roles);
            if (!hasRole) {
                fastify.log.warn({
                    route: req.url,
                    method: req.method,
                    tenantId,
                    userId,
                    actorId,
                    roles,
                }, '[RBAC] Role negada: requireRole');
                throw fastify.httpErrors.forbidden(`Requires one of roles: ${roles.join(', ')}`);
            }
        };
    });
};
exports.rbacPlugin = (0, fastify_plugin_1.default)(rbacPluginImpl, {
    name: 'rbac-plugin',
    dependencies: ['tenant-plugin', 'auth-plugin', 'action-context-plugin'],
});
