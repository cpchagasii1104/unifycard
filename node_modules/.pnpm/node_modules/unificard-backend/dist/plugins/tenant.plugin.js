"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/plugins/tenant.plugin.ts
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
/**
 * Tenant Plugin
 *
 * Responsabilidade:
 *  - Ler o tenantId do request (header x-tenant-id)
 *  - Validar presença
 *  - Injetar em req.tenant.id
 *
 * Escopo:
 *  - Registrado apenas no bloco "protegido" no server.ts
 */
const tenantPlugin = async (fastify) => {
    fastify.decorateRequest('tenant', null);
    fastify.addHook('preHandler', async (req) => {
        const rawTenantId = req.headers['x-tenant-id'];
        if (!rawTenantId || typeof rawTenantId !== 'string') {
            // 400 Bad Request - problema na requisição, não autenticação
            throw fastify.httpErrors.badRequest('Missing tenant ID in header x-tenant-id');
        }
        req.tenant = { id: rawTenantId };
    });
};
exports.default = (0, fastify_plugin_1.default)(tenantPlugin, {
    name: 'tenant-plugin',
});
//# sourceMappingURL=tenant.plugin.js.map