"use strict";
// src/core/feed/feed.routes.ts
// Rotas para Feed Contextual
Object.defineProperty(exports, "__esModule", { value: true });
const feed_service_1 = require("./feed.service");
const feedRoutes = async (fastify) => {
    /**
     * GET /feed/contextual
     * Busca feed contextual baseado no estado inferido do usuário
     */
    fastify.get('/contextual', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const limit = parseInt(req.query.limit || '20', 10);
            const feed = await feed_service_1.feedService.getContextualFeed(req.tenant.id, req.user.id, limit);
            return reply.send({ ok: true, data: feed });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar feed contextual');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao buscar feed contextual',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = feedRoutes;
//# sourceMappingURL=feed.routes.js.map