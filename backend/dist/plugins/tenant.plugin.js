"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantPlugin = void 0;
// src/plugins/tenant.plugin.ts
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Tenant Plugin
 *
 * Responsabilidade:
 *  - Ler o tenantId EXCLUSIVAMENTE do JWT já validado
 *  - Validar presença
 *  - Injetar em req.tenant.id
 *
 * REGRA DE OURO:
 *  - Header x-tenant-id NÃO é fonte de verdade
 *  - Tenant SEMPRE vem do JWT
 *
 * Escopo:
 *  - Registrado apenas no bloco "protegido" no server.ts
 */
const tenantPluginImpl = async (fastify) => {
    fastify.decorateRequest('tenant', null);
    fastify.addHook('preHandler', async (req, reply) => {
        // 🔴 GARANTIA CANÔNICA: tenantPlugin NUNCA roda em rotas /auth/*
        // authModule está registrado FORA do escopo protegido (server.ts linha 203)
        // Se este hook rodar em /auth/*, é erro de configuração ou violação de fronteira
        // 🔴 HARD BOUNDARY: Detecção explícita de rotas /auth/*
        // Verificar tanto URL completa quanto pathname (caso haja query string)
        const urlPath = req.url.split('?')[0]; // Remover query string
        const isAuthRoute = urlPath.startsWith('/auth') || urlPath.startsWith('/auth/');
        if (isAuthRoute) {
            // 🔴 LOG CANÔNICO: Violação de fronteira - tenantPlugin não deveria processar /auth/*
            fastify.log.warn({
                pid: process.pid,
                route: req.url,
                urlPath,
                method: req.method,
                hasTenantHeader: !!req.headers['x-tenant-id'],
                hasAuthHeader: !!req.headers['authorization'],
                tenantPluginScope: 'protected',
                authModuleScope: 'public',
            }, '⚠️ [TENANT] VIOLAÇÃO DE FRONTEIRA: tenantPlugin tentou processar rota /auth/* - early return imediato');
            // 🔴 GARANTIA: Early return IMEDIATO - nenhuma mutação de request
            // NÃO definir req.tenant
            // NÃO processar lógica de tenant
            // NÃO lançar erros
            // Apenas retornar silenciosamente (authModule não precisa de tenant)
            return;
        }
        /**
         * 🔐 FONTE ÚNICA DE VERDADE
         * Extrair tenantId diretamente do JWT payload já validado pelo authPlugin
         * NÃO usar req.user - JWT é a única fonte de verdade
         */
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // JWT ausente - authPlugin já deveria ter bloqueado, mas fail-fast aqui também
            throw fastify.httpErrors.unauthorized('Missing or invalid Authorization header');
        }
        const token = authHeader.substring(7).trim();
        // Decodificar JWT (sem verificar - authPlugin já validou)
        // Extrair tenantId diretamente do payload
        let jwtPayload;
        try {
            jwtPayload = jsonwebtoken_1.default.decode(token, { complete: false });
        }
        catch (err) {
            throw fastify.httpErrors.unauthorized('Invalid token format');
        }
        if (!jwtPayload || typeof jwtPayload !== 'object') {
            throw fastify.httpErrors.unauthorized('Invalid token payload');
        }
        // 🔴 GARANTIA CANÔNICA: tenantId DEVE existir no JWT payload
        const jwtTenantId = jwtPayload.tenantId;
        if (!jwtTenantId || typeof jwtTenantId !== 'string') {
            /**
             * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
             * Motivo: Permitir requisições sem tenant em DEV, com UX amigável
             * Contexto: Desenvolvimento local
             * Tipo: temporária
             */
            const isDev = process.env.NODE_ENV !== 'production';
            if (isDev) {
                // 🔴 BLINDAGEM: Rotas de API nunca redirecionam
                // NOTA: /auth já foi bloqueado acima (early return) - não precisa estar aqui
                const urlPathForApiCheck = req.url.split('?')[0];
                const isApiRoute = urlPathForApiCheck.startsWith('/marketplace') ||
                    urlPathForApiCheck.startsWith('/api') ||
                    urlPathForApiCheck.startsWith('/bank') ||
                    urlPathForApiCheck.startsWith('/social') ||
                    // /auth já foi bloqueado acima - não processar aqui
                    urlPathForApiCheck.startsWith('/health') ||
                    urlPathForApiCheck.startsWith('/webhooks') ||
                    urlPathForApiCheck.startsWith('/pay') ||
                    urlPathForApiCheck.startsWith('/uploads') ||
                    urlPathForApiCheck.startsWith('/ledger') ||
                    urlPathForApiCheck.startsWith('/payouts') ||
                    urlPathForApiCheck.startsWith('/invoices') ||
                    urlPathForApiCheck.startsWith('/reports') ||
                    urlPathForApiCheck.startsWith('/my-orders') ||
                    urlPathForApiCheck.startsWith('/pdv') ||
                    urlPathForApiCheck.startsWith('/organization') ||
                    urlPathForApiCheck.startsWith('/public-profiles') ||
                    urlPathForApiCheck.startsWith('/automation') ||
                    urlPathForApiCheck.startsWith('/risk') ||
                    urlPathForApiCheck.startsWith('/policies');
                if (isApiRoute) {
                    fastify.log.warn({
                        route: req.url,
                        method: req.method,
                    }, '⚠️ [TENANT] MISSING_TENANT em DEV (API)');
                    return reply.status(400).send({
                        ok: false,
                        code: 'MISSING_TENANT',
                        message: 'API não deve ser acessada diretamente no browser. Use o frontend em http://localhost:5173',
                        devHint: 'Esta é uma API REST. Acesse http://localhost:5173 para usar a interface web.',
                    });
                }
                // Requisição SPA direta no browser
                const accept = req.headers.accept || '';
                const isBrowserRequest = accept.includes('text/html');
                if (isBrowserRequest) {
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                    fastify.log.info({
                        route: req.url,
                        method: req.method,
                    }, '🔀 [TENANT] Redirecionamento DEV para frontend');
                    return reply
                        .status(302)
                        .header('Location', frontendUrl)
                        .send();
                }
                // Fallback DEV
                return reply.status(400).send({
                    ok: false,
                    code: 'MISSING_TENANT',
                    message: 'Tenant ausente. Faça login pelo frontend em http://localhost:5173',
                });
            }
            // 🔴 PRODUÇÃO: rígido, sem exceção
            throw fastify.httpErrors.badRequest('Missing tenant context (JWT tenantId not found)');
        }
        // ✅ Tenant definido EXCLUSIVAMENTE pelo JWT
        req.tenant = { id: jwtTenantId };
    });
};
exports.tenantPlugin = (0, fastify_plugin_1.default)(tenantPluginImpl, {
    name: 'tenant-plugin',
});
