"use strict";
// src/core/core.routes.ts
// Rotas canônicas do CORE - fonte única de dados
Object.defineProperty(exports, "__esModule", { value: true });
const core_service_1 = require("./core.service");
const coreRoutes = async (fastify) => {
    /**
     * GET /core/profile
     * Endpoint canônico que agrega todos os dados do perfil
     *
     * Retorna:
     * - actor (para Social)
     * - personal_profile (dados pessoais básicos)
     * - professional_profile (habilidades, educação, bio)
     * - physical_profile (interesses, estilo de vida)
     * - addresses[] (endereços)
     * - contacts[] (contatos)
     * - interests[] (interesses)
     * - companies[] (empresas do usuário)
     *
     * REGRA: Se alguma parte não existir, retorna null ou array vazio
     * NUNCA retorna erro só porque uma parte está vazia
     */
    fastify.get('/profile', async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
        fastify.log.info({
            pid: process.pid,
            route: '/core/profile',
            method: 'GET',
            userId: req.user?.id,
            tenantId: req.tenant?.id,
            globalUserId: req.user?.globalUserId,
        }, '[RUNTIME] GET /core/profile');
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const profile = await core_service_1.coreService.getCompleteProfile(req.tenant.id, req.user.id, req.user.globalUserId || '');
            // 🔴 INSTRUMENTAÇÃO: Log detalhado do que está sendo retornado
            fastify.log.info({
                pid: process.pid,
                tenantId: req.tenant.id,
                userId: req.user.id,
                personalProfileFullName: profile.personal_profile?.fullName,
                personalProfilePhone: profile.personal_profile?.phone,
                personalProfileMetadataKeys: profile.personal_profile ? Object.keys(profile.personal_profile.metadata || {}) : [],
                hasPersonalProfile: !!profile.personal_profile,
                addressesCount: profile.addresses.length,
                addresses: profile.addresses,
                firstAddress: profile.addresses.length > 0 ? {
                    address_id: profile.addresses[0].address_id,
                    cep: profile.addresses[0].cep,
                    address: profile.addresses[0].address,
                    city: profile.addresses[0].city,
                    state: profile.addresses[0].state,
                } : null,
            }, '[RUNTIME] GET /core/profile - Dados retornados');
            return reply.send({ ok: true, data: profile });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar perfil completo');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar perfil completo',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = coreRoutes;
//# sourceMappingURL=core.routes.js.map