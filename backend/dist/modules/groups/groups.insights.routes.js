"use strict";
// src/modules/groups/groups.insights.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const groups_service_1 = require("./groups.service");
const groups_insights_service_1 = require("./groups.insights.service");
const groupsInsightsRoutes = async (fastify) => {
    /**
     * GET /groups/insights/my-groups
     * Insights dos grupos do usuário
     */
    fastify.get('/my-groups', {
        preHandler: fastify.requirePermission(['groups:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const userId = req.user.globalUserId || req.user.id;
        const groups = await groups_service_1.groupsService.getUserGroups(tenantId, userId);
        const insights = await Promise.all(groups.map((group) => groups_insights_service_1.groupsInsightsService.getGroupInsights(tenantId, group.groupId)));
        return { groups: insights };
    });
    /**
     * GET /groups/insights/:groupId
     * Insights de um grupo específico
     */
    fastify.get('/:groupId', {
        preHandler: fastify.requirePermission(['groups:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const { groupId } = req.params;
        const group = await groups_service_1.groupsService.getGroup(tenantId, groupId);
        if (!group) {
            return reply.status(404).send({ error: 'Group not found' });
        }
        const insights = await groups_insights_service_1.groupsInsightsService.getGroupInsights(tenantId, groupId);
        return insights;
    });
};
exports.default = groupsInsightsRoutes;
