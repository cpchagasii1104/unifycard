"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/core/auth/auth.plugin.ts
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const auth_service_1 = require("@core/auth/auth.service");
const authPlugin = async (fastify) => {
    fastify.decorateRequest('user', null);
    fastify.addHook('preHandler', async (req) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw fastify.httpErrors.unauthorized('Missing or invalid Authorization header');
        }
        const token = authHeader.substring(7).trim();
        // 🔴 GARANTIA CANÔNICA: verifyAccessToken já valida tenantId e tokenVersion
        // Se falhar, é erro fatal - nenhuma request autenticada segue sem tenantId
        let payload;
        try {
            payload = await auth_service_1.authService.verifyAccessToken(token);
        }
        catch (err) {
            // Log canônico para diagnóstico
            fastify.log.error({
                route: req.url,
                method: req.method,
                error: err.message,
                statusCode: err.statusCode,
            }, '❌ [AUTH] Falha na validação de token');
            throw fastify.httpErrors.unauthorized(err.message || 'Invalid or expired token');
        }
        // 🔴 GARANTIA CANÔNICA: verifyAccessToken já garantiu tenantId e tokenVersion
        // Esta validação é redundante mas explícita para clareza arquitetural
        if (!payload.tenantId || typeof payload.tenantId !== 'string') {
            fastify.log.error({
                route: req.url,
                method: req.method,
                hasPayload: !!payload,
                payloadKeys: payload ? Object.keys(payload) : [],
            }, '❌ [AUTH] tenantId ausente no JWT após verifyAccessToken - estado inválido');
            throw fastify.httpErrors.unauthorized('Invalid token: tenantId missing');
        }
        // 🔴 GARANTIA CANÔNICA: tokenVersion deve estar presente
        if (typeof payload.tokenVersion !== 'number') {
            fastify.log.error({
                route: req.url,
                method: req.method,
                hasPayload: !!payload,
                payloadKeys: payload ? Object.keys(payload) : [],
            }, '❌ [AUTH] tokenVersion ausente no JWT após verifyAccessToken - estado inválido');
            throw fastify.httpErrors.unauthorized('Invalid token: tokenVersion missing');
        }
        // 🔐 NOVA LÓGICA: JWT é a fonte de verdade para tenant
        // Não validamos header vs JWT - apenas usamos o JWT
        // Isso resolve TENANT_MISMATCH quando frontend envia tenant errado
        const reqAny = req;
        const headerTenantId = req.headers['x-tenant-id'];
        // 🔐 Log de validação de tenant - JWT vs Header
        fastify.log.info({
            route: req.url,
            method: req.method,
            headerTenantId,
            jwtTenantId: payload.tenantId,
            jwtUserId: payload.userId ?? payload.sub,
        }, '🔍 [AUTH] Validação de tenant');
        if (headerTenantId && headerTenantId !== payload.tenantId) {
            // Log de aviso (não erro) - frontend enviou tenant diferente
            fastify.log.warn({
                route: req.url,
                headerTenantId,
                jwtTenantId: payload.tenantId,
            }, '⚠️ [AUTH] Header x-tenant-id diferente do JWT - usando JWT');
        }
        // 🔴 GARANTIA CANÔNICA: authPlugin NÃO roda em /auth/* (authModule está fora do escopo protegido)
        // authPlugin só roda no escopo protegido, onde tenantPlugin também roda
        // tenantPlugin é responsável por definir req.tenant baseado em req.user.tenantId
        // authPlugin apenas valida JWT e injeta req.user - NÃO define req.tenant
        // 🔴 GARANTIA CANÔNICA: userId OBRIGATÓRIO (sub sempre presente em JWT válido)
        // Se sub estiver ausente, JWT é inválido (jwt.verify já falharia)
        const userId = payload.userId ?? payload.sub;
        if (!userId || typeof userId !== 'string') {
            fastify.log.error({
                route: req.url,
                method: req.method,
                hasPayload: !!payload,
                payloadKeys: payload ? Object.keys(payload) : [],
            }, '❌ [AUTH] userId ausente no JWT após verifyAccessToken - estado inválido');
            throw fastify.httpErrors.unauthorized('Invalid token: userId missing');
        }
        // 🚀 Preenche req.user com userId, tenantId, email e globalUserId (se disponível)
        // 🔴 CRÍTICO: Adicionar alias 'id' para compatibilidade com endpoints que usam req.user.id
        reqAny.user = {
            userId: userId,
            id: userId, // Alias para compatibilidade - muitos endpoints usam req.user.id
            tenantId: payload.tenantId, // Já validado acima
            email: payload.email ?? undefined, // Opcional - não quebra se ausente
            globalUserId: payload.globalUserId ?? undefined, // Opcional - não quebra se ausente
        };
        // Log final de sucesso
        fastify.log.info({
            route: req.url,
            userId: reqAny.user.userId,
            tenantId: reqAny.user.tenantId,
            email: reqAny.user.email,
        }, '✅ [AUTH] Autenticação validada com sucesso');
    });
};
exports.default = (0, fastify_plugin_1.default)(authPlugin, {
    name: 'auth-plugin',
    // ⚠️ NÃO tem dependência de tenant-plugin porque auth.plugin.ts só roda no escopo protegido
    // onde tenantPlugin já está registrado antes (server.ts linha 293-294)
});
