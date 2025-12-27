"use strict";
// src/modules/social/social-group.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const social_group_service_1 = require("./social-group.service");
const zod_1 = require("zod");
const createGroupPostSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(5000),
    media: zod_1.z.array(zod_1.z.any()).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    categories: zod_1.z.array(zod_1.z.string()).optional(),
    intent: zod_1.z.string().optional(),
});
const socialGroupRoutes = async (fastify) => {
    /**
     * GET /social/groups/:groupId
     * Informações sociais do grupo
     */
    fastify.get('/groups/:groupId', {
        preHandler: fastify.requirePermission(['social:groups:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const { groupId } = req.params;
        const requestId = req.requestId || req.id;
        try {
            const info = await social_group_service_1.socialGroupService.getGroupSocialInfo(tenantId, groupId);
            if (!info) {
                return reply.status(404).send({ error: 'Group not found' });
            }
            req.log.info({
                requestId,
                tenantId,
                userId: req.user.id,
                groupId,
                action: 'get_group_social_info',
                source: 'social_layer',
            }, 'Group social info retrieved');
            return info;
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                groupId,
                err: error,
                action: 'get_group_social_info',
                source: 'social_layer',
            }, 'Error retrieving group social info');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * GET /social/groups/:groupId/feed
     * Feed de posts do grupo
     */
    fastify.get('/groups/:groupId/feed', {
        preHandler: fastify.requirePermission(['social:groups:feed:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const { groupId } = req.params;
        const query = req.query || {};
        const requestId = req.requestId || req.id;
        try {
            const feed = await social_group_service_1.socialGroupService.getGroupFeed(tenantId, groupId, {
                limit: query.limit ? Number(query.limit) : undefined,
                offset: query.offset ? Number(query.offset) : undefined,
                includeAutoPosts: query.includeAutoPosts === 'true',
            });
            req.log.info({
                requestId,
                tenantId,
                userId: req.user.id,
                groupId,
                postCount: feed.posts.length,
                action: 'get_group_feed',
                source: 'social_layer',
            }, 'Group feed retrieved');
            return feed;
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                groupId,
                err: error,
                action: 'get_group_feed',
                source: 'social_layer',
            }, 'Error retrieving group feed');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * POST /social/groups/:groupId/posts
     * Criar post dentro do grupo
     */
    fastify.post('/groups/:groupId/posts', {
        preHandler: fastify.requirePermission(['social:groups:post']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const globalUserId = req.user.globalUserId || req.user.id;
        const { groupId } = req.params;
        const requestId = req.requestId || req.id;
        const parsed = createGroupPostSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const post = await social_group_service_1.socialGroupService.createGroupPost(fastify, tenantId, groupId, globalUserId, parsed.data);
            req.log.info({
                requestId,
                tenantId,
                userId: globalUserId,
                groupId,
                postId: post.postId,
                action: 'create_group_post',
                source: 'social_layer',
            }, 'Group post created');
            return reply.status(201).send(post);
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId: globalUserId,
                groupId,
                err: error,
                action: 'create_group_post',
                source: 'social_layer',
            }, 'Error creating group post');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * GET /social/my-groups
     * Lista grupos do usuário com informações sociais
     */
    fastify.get('/my-groups', {
        preHandler: fastify.requirePermission(['social:groups:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const globalUserId = req.user.globalUserId || req.user.id;
        return social_group_service_1.socialGroupService.getMyGroups(tenantId, globalUserId);
    });
    /**
     * GET /social/impact/my-feed
     * Feed de impacto combinado
     */
    fastify.get('/impact/my-feed', {
        preHandler: fastify.requirePermission(['social:impact:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const globalUserId = req.user.globalUserId || req.user.id;
        const query = req.query || {};
        return social_group_service_1.socialGroupService.getImpactFeed(tenantId, globalUserId, {
            limit: query.limit ? Number(query.limit) : undefined,
            offset: query.offset ? Number(query.offset) : undefined,
        });
    });
    /**
     * GET /social/groups/:groupId/insights
     * Insights sociais do grupo
     */
    fastify.get('/groups/:groupId/insights', {
        preHandler: fastify.requirePermission(['social:groups:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const { groupId } = req.params;
        const insights = await social_group_service_1.socialGroupService.getGroupInsights(tenantId, groupId);
        if (!insights) {
            return reply.status(404).send({ error: 'Group not found' });
        }
        return insights;
    });
};
exports.default = socialGroupRoutes;
//# sourceMappingURL=social-group.routes.js.map