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
 * RBAC V2 Plugin
 *
 * Conforme RBAC_V2_CONTRACT.md:
 * - RBAC opera exclusivamente sobre ActionContext (SSOT)
 * - RBAC recebe exclusivamente: actorId + intent + scope
 * - RBAC NÃO referencia req.user
 * - RBAC NÃO valida identidade técnica
 *
 * Fornece decorators para autorização em rotas:
 *  - requirePermission: actor precisa de TODAS as permissions para o intent no scope
 *  - requireAnyPermission: actor precisa de pelo menos UMA permission para o intent no scope
 *  - requireRole: actor precisa de pelo menos UMA role para o intent no scope
 */
const rbacPluginImpl = async (fastify) => {
    /**
     * Validação de ActionContext obrigatório
     * Conforme RBAC_V2_CONTRACT.md Seção 3
     */
    function validateActionContext(req, operation) {
        // GUARD 1: Tenant obrigatório
        if (!req.tenant || !req.tenant.id) {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                reason: 'Tenant ausente no RBAC',
            }, '❌ [RBAC V2] Falha: Tenant ausente');
            throw fastify.httpErrors.unauthorized('RBAC_V2_INVARIANT_VIOLATION: Tenant is required');
        }
        // GUARD 2: ActionContext obrigatório
        // Conforme RBAC_V2_CONTRACT.md Seção 3
        if (!req.actionContext) {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                reason: 'ActionContext ausente no RBAC',
            }, '❌ [RBAC V2] Falha: ActionContext ausente');
            throw fastify.httpErrors.badRequest('RBAC_V2_INVARIANT_VIOLATION: ActionContext is required. Ensure action-context-middleware runs before RBAC.');
        }
        // GUARD 3: Campos mínimos obrigatórios
        // Conforme ACTIONCONTEXT_CONTRACT.md Seção 3
        if (!req.actionContext.actorId || req.actionContext.actorId.trim() === '') {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                reason: 'ActionContext.actorId ausente ou vazio',
            }, '❌ [RBAC V2] Falha: actorId ausente');
            throw fastify.httpErrors.badRequest('RBAC_V2_INVARIANT_VIOLATION: ActionContext.actorId is required');
        }
        if (!req.actionContext.intent || req.actionContext.intent.trim() === '') {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                reason: 'ActionContext.intent ausente ou vazio',
            }, '❌ [RBAC V2] Falha: intent ausente');
            throw fastify.httpErrors.badRequest('RBAC_V2_INVARIANT_VIOLATION: ActionContext.intent is required');
        }
        if (!req.actionContext.scope || req.actionContext.scope.trim() === '') {
            fastify.log.error({
                route: req.url,
                method: req.method,
                operation,
                tenantId: req.tenant.id,
                reason: 'ActionContext.scope ausente ou vazio',
            }, '❌ [RBAC V2] Falha: scope ausente');
            throw fastify.httpErrors.badRequest('RBAC_V2_INVARIANT_VIOLATION: ActionContext.scope is required');
        }
    }
    // Decorator: requirePermission (TODAS)
    // Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
    fastify.decorate('requirePermission', (permissions) => {
        return async (req, reply) => {
            // Validação de ActionContext obrigatório
            validateActionContext(req, 'requirePermission');
            const tenantId = req.tenant.id;
            const { actorId, intent, scope } = req.actionContext;
            fastify.log.debug({
                route: req.url,
                method: req.method,
                tenantId,
                actorId,
                intent,
                scope,
                permissions,
            }, '[RBAC V2] Verificando requirePermission');
            // Usar método V2: actorHasAllPermissions
            // Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
            const check = await rbac_service_1.rbacService.actorHasAllPermissions(tenantId, actorId, intent, scope, permissions);
            if (!check.hasPermission) {
                fastify.log.warn({
                    route: req.url,
                    method: req.method,
                    tenantId,
                    actorId,
                    intent,
                    scope,
                    permissions,
                    reason: check.reason,
                }, '[RBAC V2] Permissão negada: requirePermission');
                throw fastify.httpErrors.forbidden(check.reason || `Requires permissions: ${permissions.join(', ')} for intent "${intent}" in scope "${scope}"`);
            }
        };
    });
    // Decorator: requireAnyPermission (QUALQUER UMA)
    // Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
    fastify.decorate('requireAnyPermission', (permissions) => {
        return async (req, reply) => {
            // Validação de ActionContext obrigatório
            validateActionContext(req, 'requireAnyPermission');
            const tenantId = req.tenant.id;
            const { actorId, intent, scope } = req.actionContext;
            fastify.log.debug({
                route: req.url,
                method: req.method,
                tenantId,
                actorId,
                intent,
                scope,
                permissions,
            }, '[RBAC V2] Verificando requireAnyPermission');
            // Usar método V2: actorHasAnyPermission
            // Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
            const check = await rbac_service_1.rbacService.actorHasAnyPermission(tenantId, actorId, intent, scope, permissions);
            if (!check.hasPermission) {
                fastify.log.warn({
                    route: req.url,
                    method: req.method,
                    tenantId,
                    actorId,
                    intent,
                    scope,
                    permissions,
                    reason: check.reason,
                }, '[RBAC V2] Permissão negada: requireAnyPermission');
                throw fastify.httpErrors.forbidden(check.reason || `Requires at least one of: ${permissions.join(', ')} for intent "${intent}" in scope "${scope}"`);
            }
        };
    });
    // Decorator: requireRole (QUALQUER UMA)
    // Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
    fastify.decorate('requireRole', (roles) => {
        return async (req, reply) => {
            // Validação de ActionContext obrigatório
            validateActionContext(req, 'requireRole');
            const tenantId = req.tenant.id;
            const { actorId, intent, scope } = req.actionContext;
            fastify.log.debug({
                route: req.url,
                method: req.method,
                tenantId,
                actorId,
                intent,
                scope,
                roles,
            }, '[RBAC V2] Verificando requireRole');
            // Usar método V2: actorHasAnyRole
            // Conforme RBAC_V2_CONTRACT.md Seção 2: decide apenas com actorId + intent + scope
            const hasRole = await rbac_service_1.rbacService.actorHasAnyRole(tenantId, actorId, intent, scope, roles);
            if (!hasRole) {
                fastify.log.warn({
                    route: req.url,
                    method: req.method,
                    tenantId,
                    actorId,
                    intent,
                    scope,
                    roles,
                }, '[RBAC V2] Role negada: requireRole');
                throw fastify.httpErrors.forbidden(`Requires one of roles: ${roles.join(', ')} for intent "${intent}" in scope "${scope}"`);
            }
        };
    });
};
exports.rbacPlugin = (0, fastify_plugin_1.default)(rbacPluginImpl, {
    name: 'rbac-plugin',
    dependencies: ['tenant-plugin', 'auth-plugin', 'action-context-plugin'],
});
