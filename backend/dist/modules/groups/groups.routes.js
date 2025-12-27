"use strict";
// src/modules/groups/groups.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const groups_service_1 = require("./groups.service");
const zod_1 = require("zod");
const createGroupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(2000).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const updateGroupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(2000).optional(),
    isActive: zod_1.z.boolean().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    profit_percentage: zod_1.z.number().min(0).max(100).optional(),
});
const groupsRoutes = async (fastify) => {
    /**
     * POST /groups
     * Criar novo grupo
     */
    fastify.post('/', {
        preHandler: fastify.requirePermission(['groups:create']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.globalUserId || req.user.id;
        const requestId = req.requestId || req.id;
        const parsed = createGroupSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const group = await groups_service_1.groupsService.createGroup(tenantId, userId, parsed.data);
            req.log.info({
                requestId,
                tenantId,
                userId,
                groupId: group.groupId,
                action: 'group_created',
                source: 'groups',
            }, 'Group created');
            return reply.status(201).send(group);
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                err: error,
                action: 'group_created',
                source: 'groups',
            }, 'Error creating group');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * GET /groups
     * Listar grupos
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['groups:read']),
    }, async (req) => {
        const tenantId = req.tenant.id;
        const query = req.query;
        const isActive = query?.isActive !== undefined ? query.isActive === 'true' : undefined;
        return groups_service_1.groupsService.listGroups(tenantId, { isActive });
    });
    /**
     * GET /groups/:id
     * Buscar grupo por ID
     */
    fastify.get('/:id', {
        preHandler: fastify.requirePermission(['groups:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const group = await groups_service_1.groupsService.getGroup(tenantId, id);
        if (!group) {
            return reply.status(404).send({ error: 'Group not found' });
        }
        return group;
    });
    /**
     * PUT /groups/:id
     * Atualizar grupo
     */
    fastify.put('/:id', {
        preHandler: fastify.requirePermission(['groups:update']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.globalUserId || req.user.id;
        const { id } = req.params;
        const requestId = req.requestId || req.id;
        const parsed = updateGroupSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const group = await groups_service_1.groupsService.updateGroup(tenantId, id, userId, parsed.data);
            req.log.info({
                requestId,
                tenantId,
                userId,
                groupId: id,
                action: 'group_updated',
                source: 'groups',
            }, 'Group updated');
            return group;
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                groupId: id,
                err: error,
                action: 'group_updated',
                source: 'groups',
            }, 'Error updating group');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * DELETE /groups/:id
     * Deletar grupo (soft-delete)
     */
    fastify.delete('/:id', {
        preHandler: fastify.requirePermission(['groups:delete']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.globalUserId || req.user.id;
        const { id } = req.params;
        const requestId = req.requestId || req.id;
        try {
            const deleted = await groups_service_1.groupsService.deleteGroup(tenantId, id, userId);
            if (!deleted) {
                return reply.status(404).send({ error: 'Group not found' });
            }
            req.log.info({
                requestId,
                tenantId,
                userId,
                groupId: id,
                action: 'group_deleted',
                source: 'groups',
            }, 'Group deleted');
            return reply.status(200).send({ success: true });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                groupId: id,
                err: error,
                action: 'group_deleted',
                source: 'groups',
            }, 'Error deleting group');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * POST /groups/:id/join
     * Entrar em um grupo
     */
    fastify.post('/:id/join', {
        preHandler: fastify.requirePermission(['groups:join']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.globalUserId || req.user.id;
        const { id } = req.params;
        const requestId = req.requestId || req.id;
        try {
            const member = await groups_service_1.groupsService.joinGroup(tenantId, id, userId);
            req.log.info({
                requestId,
                tenantId,
                userId,
                groupId: id,
                action: 'join',
                source: 'groups',
            }, 'User joined group');
            return reply.status(200).send(member);
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                groupId: id,
                err: error,
                action: 'join',
                source: 'groups',
            }, 'Error joining group');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * POST /groups/:id/leave
     * Sair de um grupo
     */
    fastify.post('/:id/leave', {
        preHandler: fastify.requirePermission(['groups:leave']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.globalUserId || req.user.id;
        const { id } = req.params;
        const requestId = req.requestId || req.id;
        try {
            const left = await groups_service_1.groupsService.leaveGroup(tenantId, id, userId);
            if (!left) {
                return reply.status(404).send({ error: 'Member not found' });
            }
            req.log.info({
                requestId,
                tenantId,
                userId,
                groupId: id,
                action: 'leave',
                source: 'groups',
            }, 'User left group');
            return reply.status(200).send({ success: true });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                groupId: id,
                err: error,
                action: 'leave',
                source: 'groups',
            }, 'Error leaving group');
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    /**
     * GET /groups/:id/members
     * Listar membros do grupo
     */
    fastify.get('/:id/members', {
        preHandler: fastify.requirePermission(['groups:members:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const members = await groups_service_1.groupsService.getGroupMembers(tenantId, id);
        return reply.status(200).send({ members });
    });
};
exports.default = groupsRoutes;
//# sourceMappingURL=groups.routes.js.map