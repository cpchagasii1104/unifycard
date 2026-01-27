"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    /**
     * GET /social/unread-counts
     * Retorna contadores de novidade para o menu social
     * Mesma lógica de /feed/unread-counts (mantida aqui para compatibilidade)
     */
    fastify.get('/unread-counts', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        const tenantId = req.tenant.id;
        try {
            const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            // Feed: posts das últimas 24h
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const feedCount = await runQueryWithTenant(tenantId, `
        SELECT COUNT(*)::int as count
        FROM posts
        WHERE tenant_id = $1
          AND created_at >= $2
          AND visibility = 'PUBLIC'
        `, [tenantId, oneDayAgo]);
            // Grupos: grupos com atividade recente (últimos 7 dias)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const groupsCount = await runQueryWithTenant(tenantId, `
        SELECT COUNT(DISTINCT metadata->>'groupId')::int as count
        FROM posts
        WHERE tenant_id = $1
          AND metadata->>'groupId' IS NOT NULL
          AND created_at >= $2
        `, [tenantId, sevenDaysAgo]);
            // Eventos: eventos próximos (próximos 7 dias)
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
            const eventsCount = await runQueryWithTenant(tenantId, `
        SELECT COUNT(*)::int as count
        FROM events
        WHERE tenant_id = $1
          AND status IN ('PUBLISHED', 'ONGOING')
          AND start_time >= NOW()
          AND start_time <= $2
        `, [tenantId, sevenDaysFromNow]);
            // Serviços: ofertas de serviço recentes (últimos 7 dias)
            const servicesCount = await runQueryWithTenant(tenantId, `
        SELECT COUNT(*)::int as count
        FROM posts
        WHERE tenant_id = $1
          AND intent = 'service_offer'
          AND created_at >= $2
        `, [tenantId, sevenDaysAgo]);
            return {
                feed: feedCount ? Number(feedCount.count) : 0,
                groups: groupsCount ? Number(groupsCount.count) : 0,
                events: eventsCount ? Number(eventsCount.count) : 0,
                services: servicesCount ? Number(servicesCount.count) : 0,
            };
        }
        catch (error) {
            fastify.log.error({ err: error, tenantId }, 'Erro ao buscar contadores de novidade');
            // Retornar zeros em caso de erro (não quebrar UI)
            return {
                feed: 0,
                groups: 0,
                events: 0,
                services: 0,
            };
        }
    });
};
exports.default = socialRoutes;
