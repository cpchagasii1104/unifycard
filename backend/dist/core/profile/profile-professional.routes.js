"use strict";
// src/core/profile/profile-professional.routes.ts
// Rotas para perfil profissional
Object.defineProperty(exports, "__esModule", { value: true });
const profile_professional_service_1 = require("./profile-professional.service");
const profileProfessionalRoutes = async (fastify) => {
    /**
     * GET /profile/professional
     * Busca perfil profissional do usuário autenticado
     */
    fastify.get('/professional', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const profile = await profile_professional_service_1.profileProfessionalService.getProfessionalProfile(req.tenant.id, req.user.id);
            return profile || { globalUserId: '', skills: [], education: [], bio: null, availability: null };
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar perfil profissional');
            return reply.status(500).send({ error: 'Erro ao buscar perfil profissional' });
        }
    });
    /**
     * PUT /profile/professional
     * Atualiza perfil profissional do usuário autenticado
     */
    fastify.put('/professional', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const updated = await profile_professional_service_1.profileProfessionalService.updateProfessionalProfile(req.tenant.id, req.user.id, req.body);
            return updated;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar perfil profissional');
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao atualizar perfil profissional',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = profileProfessionalRoutes;
//# sourceMappingURL=profile-professional.routes.js.map