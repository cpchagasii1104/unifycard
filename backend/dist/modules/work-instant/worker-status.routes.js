"use strict";
// src/modules/work-instant/worker-status.routes.ts
//
// Rotas para gerenciar status online/offline e localização de workers
Object.defineProperty(exports, "__esModule", { value: true });
const worker_status_service_1 = require("./worker-status.service");
const rbac_service_1 = require("@core/rbac/rbac.service");
const zod_1 = require("zod");
const updateLocationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
});
const goOnlineSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90).optional(),
    longitude: zod_1.z.number().min(-180).max(180).optional(),
});
const workerStatusRoutes = async (fastify) => {
    /**
     * POST /work/instant/online
     * Marca worker como online
     * Worker autenticado pode marcar-se como online
     */
    fastify.post('/online', {
        preHandler: fastify.requirePermission(['work:instant:status']),
        schema: {
            body: {
                type: 'object',
                properties: {
                    latitude: { type: 'number', minimum: -90, maximum: 90 },
                    longitude: { type: 'number', minimum: -180, maximum: 180 },
                },
            },
        },
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const requestId = req.requestId || req.id;
        // Validar body (latitude e longitude são opcionais)
        const validated = goOnlineSchema.parse(req.body);
        req.log.info({
            requestId,
            tenantId,
            userId,
            'work-instant.action': 'heartbeat',
            action: 'online',
            hasLocation: !!(validated.latitude && validated.longitude),
            source: 'instant_mode',
        }, 'Worker going online');
        try {
            const presence = await worker_status_service_1.workerStatusService.goOnline(tenantId, userId, validated.latitude, validated.longitude);
            req.log.info({
                requestId,
                tenantId,
                userId,
                action: 'online',
                status: presence.status,
                hasLocation: !!presence.location,
                source: 'instant_mode',
            }, 'Worker marked as online successfully');
            return reply.status(200).send({
                presence,
                message: 'Worker marked as online',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                action: 'online',
                error: error instanceof Error ? error.message : String(error),
                source: 'instant_mode',
            }, 'Error marking worker as online');
            return reply.status(500).send({ error: 'Failed to mark worker as online' });
        }
    });
    /**
     * POST /work/instant/offline
     * Marca worker como offline
     * Worker autenticado pode marcar-se como offline
     */
    fastify.post('/offline', {
        preHandler: fastify.requirePermission(['work:instant:status']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const requestId = req.requestId || req.id;
        req.log.info({
            requestId,
            tenantId,
            userId,
            action: 'offline',
            source: 'instant_mode',
        }, 'Worker going offline');
        try {
            const presence = await worker_status_service_1.workerStatusService.goOffline(tenantId, userId);
            req.log.info({
                requestId,
                tenantId,
                userId,
                action: 'offline',
                status: presence.status,
                source: 'instant_mode',
            }, 'Worker marked as offline successfully');
            return reply.status(200).send({
                presence,
                message: 'Worker marked as offline',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                action: 'offline',
                error: error instanceof Error ? error.message : String(error),
                source: 'instant_mode',
            }, 'Error marking worker as offline');
            return reply.status(500).send({ error: 'Failed to mark worker as offline' });
        }
    });
    /**
     * POST /work/instant/location
     * Atualiza localização do worker
     * Worker autenticado pode atualizar sua localização
     */
    fastify.post('/location', {
        preHandler: fastify.requirePermission(['work:instant:status']),
        schema: {
            body: {
                type: 'object',
                required: ['latitude', 'longitude'],
                properties: {
                    latitude: { type: 'number', minimum: -90, maximum: 90 },
                    longitude: { type: 'number', minimum: -180, maximum: 180 },
                },
            },
        },
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const requestId = req.requestId || req.id;
        // Validar body
        const validated = updateLocationSchema.parse(req.body);
        req.log.info({
            requestId,
            tenantId,
            userId,
            'work-instant.action': 'heartbeat',
            action: 'update-location',
            latitude: validated.latitude,
            longitude: validated.longitude,
            source: 'instant_mode',
        }, 'Updating worker location (heartbeat)');
        try {
            const presence = await worker_status_service_1.workerStatusService.updateLocation(tenantId, userId, validated);
            req.log.info({
                requestId,
                tenantId,
                userId,
                action: 'update-location',
                latitude: validated.latitude,
                longitude: validated.longitude,
                status: presence.status,
                source: 'instant_mode',
            }, 'Worker location updated successfully');
            return reply.status(200).send({
                presence,
                message: 'Location updated successfully',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                action: 'update-location',
                error: error instanceof Error ? error.message : String(error),
                source: 'instant_mode',
            }, 'Error updating worker location');
            return reply.status(500).send({ error: 'Failed to update location' });
        }
    });
    /**
     * GET /work/instant/presence/:userId
     * Retorna presença e status de um worker
     * OWNER/ADMIN ou o próprio worker pode visualizar
     */
    fastify.get('/presence/:userId', {
        preHandler: fastify.requirePermission(['work:instant:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const currentUserId = req.user.id;
        const { userId } = req.params;
        const requestId = req.requestId || req.id;
        // Validar acesso: OWNER/ADMIN ou o próprio worker
        if (userId !== currentUserId) {
            const hasAdminRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, currentUserId, ['admin', 'owner']);
            if (!hasAdminRole) {
                return reply.status(403).send({
                    error: 'Only Owner, Admin, or the worker themselves can view presence',
                });
            }
        }
        req.log.info({
            requestId,
            tenantId,
            userId: currentUserId,
            targetUserId: userId,
            action: 'get-presence',
            source: 'instant_mode',
        }, 'Getting worker presence');
        try {
            const presence = await worker_status_service_1.workerStatusService.getPresence(tenantId, userId);
            if (!presence) {
                return reply.status(404).send({
                    error: 'Presence not found for this worker',
                    userId,
                });
            }
            return {
                presence,
            };
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId: currentUserId,
                targetUserId: userId,
                action: 'get-presence',
                error: error instanceof Error ? error.message : String(error),
                source: 'instant_mode',
            }, 'Error getting worker presence');
            return reply.status(500).send({ error: 'Failed to get presence' });
        }
    });
};
exports.default = workerStatusRoutes;
