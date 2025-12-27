"use strict";
// src/core/profile/profile-learning.routes.ts
// Rotas para perfil de aprendizado/trilha
Object.defineProperty(exports, "__esModule", { value: true });
const profile_learning_service_1 = require("./profile-learning.service");
const profileLearningRoutes = async (fastify) => {
    /**
     * GET /profile/learning
     * Busca perfil de aprendizado do usuário autenticado
     */
    fastify.get('/learning', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const profile = await profile_learning_service_1.profileLearningService.getLearningProfile(req.tenant.id, req.user.id);
            const data = profile || {
                globalUserId: '',
                learnings: [],
                preferences: {},
                metadata: {},
            };
            return reply.send({ ok: true, data });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar perfil de aprendizado');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar perfil de aprendizado',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * PUT /profile/learning
     * Atualiza perfil de aprendizado do usuário autenticado
     */
    fastify.put('/learning', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const input = req.body;
            const profile = await profile_learning_service_1.profileLearningService.updateLearningProfile(req.tenant.id, req.user.id, input);
            return reply.send({ ok: true, data: profile });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar perfil de aprendizado');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao atualizar perfil de aprendizado',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = profileLearningRoutes;
//# sourceMappingURL=profile-learning.routes.js.map