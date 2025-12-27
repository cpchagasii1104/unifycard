"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FeedService_1 = require("./FeedService");
const EventAvailabilityPreviewService_1 = require("./EventAvailabilityPreviewService");
const feedService = new FeedService_1.FeedService();
const availabilityPreviewService = new EventAvailabilityPreviewService_1.EventAvailabilityPreviewService();
const feedRoutes = async (fastify) => {
    /**
     * GET /api/feed
     * Feed principal (READ-ONLY)
     */
    fastify.get('/', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
            const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
            const result = await feedService.getFeed({
                tenantId: req.tenant.id,
                limit,
                offset,
                type: req.query.type,
                cityId: req.query.cityId,
            });
            // Retornar no formato do contrato
            const response = {
                items: result.items,
                total: result.total,
                posts: result.posts, // Compatibilidade reversa
            };
            return reply.status(200).send(response);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao buscar feed');
            return reply.status(500).send({ error: 'Erro ao buscar feed' });
        }
    });
    /**
     * GET /api/feed/events/:id/availability-preview
     * Preview de disponibilidade (READ-ONLY)
     * 🔴 NUNCA reserva, apenas exibe próximos slots
     */
    fastify.get('/events/:id/availability-preview', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const preview = await availabilityPreviewService.getAvailabilityPreview(req.params.id, req.tenant.id);
            if (!preview) {
                return reply.status(404).send({ error: 'Event not found' });
            }
            return reply.status(200).send(preview);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao buscar preview de disponibilidade');
            return reply.status(500).send({ error: 'Erro ao buscar preview de disponibilidade' });
        }
    });
};
exports.default = feedRoutes;
//# sourceMappingURL=feed.routes.js.map