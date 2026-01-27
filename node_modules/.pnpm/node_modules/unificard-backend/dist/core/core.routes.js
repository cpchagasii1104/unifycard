"use strict";
// src/core/core.routes.ts
// Rotas canônicas do CORE - fonte única de dados
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreRoutes = void 0;
const core_service_1 = require("./core.service");
const profile_service_1 = require("./profile/profile.service");
const coreRoutes = async (fastify) => {
    /**
     * GET /core/profile
     * Endpoint canônico que agrega todos os dados do perfil
     *
     * REGRA DE OURO:
     * - Tenant vem SEMPRE do JWT (req.user.tenantId)
     * - req.tenant é apenas um espelho validado, nunca fonte primária
     */
    fastify.get('/profile', async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado
        fastify.log.info({
            pid: process.pid,
            route: '/core/profile',
            method: 'GET',
            userId: req.user?.userId,
            jwtTenantId: req.user?.tenantId,
            reqTenantId: req.tenant?.id,
        }, '[RUNTIME] GET /core/profile');
        if (!req.user) {
            return reply.status(401).send({
                ok: false,
                message: 'Não autenticado',
            });
        }
        /**
         * 🔐 FONTE ÚNICA DE VERDADE
         * Nunca confiar em req.tenant se não bater com o JWT
         */
        const tenantId = req.user.tenantId;
        if (!tenantId || typeof tenantId !== 'string') {
            return reply.status(400).send({
                ok: false,
                message: 'Tenant não encontrado no JWT',
            });
        }
        // Blindagem adicional: detectar inconsistência (diagnóstico)
        if (req.tenant && req.tenant.id !== tenantId) {
            fastify.log.error({
                jwtTenantId: tenantId,
                reqTenantId: req.tenant.id,
            }, '[SECURITY] Tenant mismatch: req.tenant diverge do JWT');
        }
        try {
            const userId = req.user.userId;
            if (!userId) {
                return reply.status(400).send({
                    ok: false,
                    message: 'User ID não encontrado',
                });
            }
            // Actor opcional via query
            const actorId = req.query?.actorId;
            const profile = await core_service_1.coreService.getCompleteProfile(tenantId, userId, actorId);
            // Log resumido do payload retornado
            fastify.log.info({
                pid: process.pid,
                tenantId,
                userId,
                hasPersonalProfile: !!profile.personal_profile,
                addressesCount: profile.addresses.length,
            }, '[RUNTIME] GET /core/profile - OK');
            return reply.send({ ok: true, data: profile });
        }
        catch (error) {
            fastify.log.error({ err: error, tenantId: req.user.tenantId, userId: req.user.userId }, 'Erro ao buscar perfil completo');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar perfil completo',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
    /**
     * PUT /core/profile
     * Persistir dados de profile
     *
     * REGRA:
     * - Tenant SEMPRE do JWT
     */
    fastify.put('/profile', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({
                ok: false,
                message: 'Não autenticado',
            });
        }
        const tenantId = req.user.tenantId;
        const userId = req.user.userId;
        if (!tenantId || !userId) {
            return reply.status(401).send({
                ok: false,
                message: 'Unauthorized',
            });
        }
        // Blindagem de inconsistência
        if (req.tenant && req.tenant.id !== tenantId) {
            fastify.log.error({
                jwtTenantId: tenantId,
                reqTenantId: req.tenant.id,
            }, '[SECURITY] Tenant mismatch em PUT /core/profile');
        }
        const input = req.body;
        await profile_service_1.profileService.upsertProfile(tenantId, userId, input);
        return reply.send({ ok: true });
    });
};
exports.coreRoutes = coreRoutes;
