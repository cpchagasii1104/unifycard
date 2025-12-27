"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const social_service_1 = require("./social.service");
const social_schemas_1 = require("./social.schemas");
const socialRoutes = async (fastify) => {
    /**
     * POST /social/posts/create
     * Cria um novo post com análise automática de intent e categorias
     */
    fastify.post('/posts/create', {
        schema: {
            body: {
                type: 'object',
                required: ['content'],
                properties: {
                    content: { type: 'string' },
                    media: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['image', 'video', 'audio'] },
                                url: { type: 'string' },
                                thumbnailUrl: { type: 'string' },
                                duration: { type: 'number' },
                                metadata: { type: 'object' },
                            },
                        },
                    },
                    metadata: { type: 'object' },
                    categories: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    intent: { type: 'string' },
                    serviceInfo: {
                        type: 'object',
                        properties: {
                            categoryId: { type: 'string' },
                            categoryName: { type: 'string' },
                            price: { type: 'number' },
                            pricingType: { type: 'string', enum: ['hourly', 'daily', 'weekly', 'monthly', 'quote'] },
                            currency: { type: 'string' },
                            description: { type: 'string' },
                            duration: { type: 'number' },
                            requiresSchedule: { type: 'boolean' },
                            requiresPayment: { type: 'boolean' },
                        },
                    },
                    isServicePost: { type: 'boolean' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(404).send({ error: 'Identidade global não encontrada' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const validated = social_schemas_1.createPostSchema.parse(req.body);
            const post = await social_service_1.socialService.createPost(req.server, req.tenant.id, req.user.globalUserId, validated);
            return reply.status(201).send(post);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao criar post');
            return reply.status(500).send({ error: 'Erro ao criar post' });
        }
    });
    /**
     * GET /social/posts/:postId
     * Busca um post por ID
     */
    fastify.get('/posts/:postId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    postId: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const post = await social_service_1.socialService.getPost(req.tenant.id, req.params.postId);
            if (!post) {
                return reply.status(404).send({ error: 'Post não encontrado' });
            }
            return post;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar post');
            return reply.status(500).send({ error: 'Erro ao buscar post' });
        }
    });
    // NOTA: GET /social/feed foi movido para social-2.0.routes.ts (canônico)
    // Esta rota antiga foi removida para evitar duplicação
};
exports.default = socialRoutes;
//# sourceMappingURL=social.routes.js.map