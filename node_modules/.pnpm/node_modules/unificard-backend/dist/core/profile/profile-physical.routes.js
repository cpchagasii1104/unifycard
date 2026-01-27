"use strict";
// src/core/profile/profile-physical.routes.ts
// Rotas para perfil físico/interesses
Object.defineProperty(exports, "__esModule", { value: true });
const profile_physical_service_1 = require("./profile-physical.service");
const profilePhysicalRoutes = async (fastify) => {
    /**
     * GET /profile/physical
     * Busca perfil físico/interesses do usuário autenticado
     */
    fastify.get('/physical', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const profile = await profile_physical_service_1.profilePhysicalService.getPhysicalProfile(req.tenant.id, req.user.id);
            const data = profile || {
                globalUserId: '',
                interests: [],
                lifestyle: {
                    drinks: null,
                    smokes: null,
                    relationshipStatus: null,
                    sexualOrientation: null,
                },
                preferences: {},
                metadata: {},
            };
            return reply.send({ ok: true, data });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar perfil físico');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar perfil físico',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * PUT /profile/physical
     * Atualiza perfil físico/interesses do usuário autenticado
     */
    fastify.put('/physical', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const updated = await profile_physical_service_1.profilePhysicalService.updatePhysicalProfile(req.tenant.id, req.user.id, req.body);
            return updated;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar perfil físico');
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao atualizar perfil físico',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = profilePhysicalRoutes;
