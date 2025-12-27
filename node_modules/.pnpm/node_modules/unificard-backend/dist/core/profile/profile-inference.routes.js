"use strict";
// src/core/profile/profile-inference.routes.ts
// Rotas para motor de inferência entre trilhas
Object.defineProperty(exports, "__esModule", { value: true });
const profile_inference_service_1 = require("./profile-inference.service");
const profileInferenceRoutes = async (fastify) => {
    /**
     * GET /profile/inference
     * Busca inferências e sugestões baseadas no perfil do usuário
     * Retorna estado do usuário, sugestões contextuais e insights
     */
    fastify.get('/inference', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const inferences = await profile_inference_service_1.profileInferenceService.getInferences(req.tenant.id, req.user.id);
            return reply.send({ ok: true, data: inferences });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar inferências');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar inferências',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * GET /profile/inference/snapshot
     * Busca snapshot do perfil do usuário (para debug/analytics)
     */
    fastify.get('/inference/snapshot', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const snapshot = await profile_inference_service_1.profileInferenceService.getUserProfileSnapshot(req.tenant.id, req.user.id);
            const userState = profile_inference_service_1.profileInferenceService.detectUserState(snapshot);
            return reply.send({
                ok: true,
                data: {
                    snapshot,
                    userState,
                }
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar snapshot');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar snapshot',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /profile/inference/action
     * Registra ação do usuário sobre uma sugestão (accept ou dismiss)
     */
    fastify.post('/inference/action', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const { suggestionId, action } = req.body;
            if (!suggestionId || !action || (action !== 'accept' && action !== 'dismiss')) {
                return reply.status(400).send({
                    ok: false,
                    message: 'suggestionId e action (accept|dismiss) são obrigatórios'
                });
            }
            await profile_inference_service_1.profileInferenceService.recordSuggestionAction(req.tenant.id, req.user.id, suggestionId, action);
            return reply.send({ ok: true });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao registrar ação de sugestão');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao registrar ação',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = profileInferenceRoutes;
//# sourceMappingURL=profile-inference.routes.js.map