"use strict";
// src/core/matching/matching.routes.ts
// Rotas para Matching Humano
Object.defineProperty(exports, "__esModule", { value: true });
const matching_service_1 = require("./matching.service");
const matchingRoutes = async (fastify) => {
    /**
     * GET /matching/suggestions
     * Busca sugestões de matching baseadas no estado e afinidade
     */
    fastify.get('/suggestions', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const limit = parseInt(req.query.limit || '5', 10);
            const result = await matching_service_1.matchingService.getMatchingSuggestions(req.tenant.id, req.user.id, limit);
            return reply.send({ ok: true, data: result });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar sugestões de matching');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar sugestões de matching',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * POST /matching/action
     * Registra ação do usuário sobre uma sugestão (accept ou dismiss)
     */
    fastify.post('/action', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const { matchId, action } = req.body;
            if (!matchId || !action || (action !== 'accept' && action !== 'dismiss')) {
                return reply.status(400).send({
                    ok: false,
                    message: 'matchId e action (accept|dismiss) são obrigatórios'
                });
            }
            await matching_service_1.matchingService.recordMatchAction(req.tenant.id, req.user.id, matchId, action);
            return reply.send({ ok: true });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao registrar ação de matching');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao registrar ação',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = matchingRoutes;
//# sourceMappingURL=matching.routes.js.map