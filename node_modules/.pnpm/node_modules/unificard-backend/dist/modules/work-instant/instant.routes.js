"use strict";
// src/modules/work-instant/instant.routes.ts
//
// Rotas para Work Instant (matching em tempo real)
Object.defineProperty(exports, "__esModule", { value: true });
const instant_service_1 = require("./instant.service");
const zod_1 = require("zod");
const createInstantRequestSchema = zod_1.z.object({
    categoryId: zod_1.z.string().uuid('Category ID must be a valid UUID'),
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    description: zod_1.z.string().optional(),
});
const instantRoutes = async (fastify) => {
    /**
     * POST /work/instant/request
     * Cria uma solicitação de serviço instantâneo
     * Qualquer usuário autenticado pode criar
     */
    fastify.post('/request', {
        preHandler: fastify.requirePermission(['work:instant:create']),
        schema: {
            body: {
                type: 'object',
                required: ['categoryId', 'latitude', 'longitude'],
                properties: {
                    categoryId: { type: 'string', format: 'uuid' },
                    latitude: { type: 'number', minimum: -90, maximum: 90 },
                    longitude: { type: 'number', minimum: -180, maximum: 180 },
                    description: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const requestId = req.requestId || req.id;
        // Validar body
        const validated = createInstantRequestSchema.parse(req.body);
        req.log.info({
            requestId,
            tenantId,
            userId,
            categoryId: validated.categoryId,
            'work-instant.action': 'create',
            source: 'instant_mode',
        }, 'Creating instant service request');
        try {
            const result = await instant_service_1.instantService.requestService(tenantId, userId, validated);
            req.log.info({
                requestId,
                tenantId,
                userId,
                categoryId: validated.categoryId,
                instantRequestId: result.requestId,
                matchedCount: result.workersMatched.length,
                'work-instant.action': 'smart-match',
                source: 'instant_mode',
            }, 'Instant service request created with smart matching');
            return reply.status(201).send({
                requestId: result.requestId,
                workersMatched: result.workersMatched,
                message: 'Instant service request created',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                categoryId: validated.categoryId,
                error: error instanceof Error ? error.message : String(error),
                'work-instant.action': 'request-create-error',
                source: 'instant_mode',
            }, 'Error creating instant service request');
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('No workers')) {
                    return reply.status(404).send({ error: error.message });
                }
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Failed to create instant service request' });
        }
    });
    /**
     * POST /work/instant/:requestId/accept
     * Worker aceita uma solicitação
     * Apenas worker autenticado pode aceitar
     */
    fastify.post('/:requestId/accept', {
        preHandler: fastify.requirePermission(['work:instant:accept']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { requestId } = req.params;
        const logRequestId = req.requestId || req.id;
        req.log.info({
            requestId: logRequestId,
            tenantId,
            userId,
            instantRequestId: requestId,
            'work-instant.action': 'accept',
            source: 'instant_mode',
        }, 'Worker accepting instant service request');
        try {
            const result = await instant_service_1.instantService.acceptRequest(tenantId, requestId, userId);
            req.log.info({
                requestId: logRequestId,
                tenantId,
                userId,
                instantRequestId: requestId,
                assignmentId: result.assignment.assignmentId,
                jobId: result.request.tempJobId,
                'work-instant.action': 'request-accepted',
                source: 'instant_mode',
            }, 'Instant service request accepted successfully');
            return reply.status(200).send({
                assignment: result.assignment,
                request: result.request,
                message: 'Request accepted successfully',
            });
        }
        catch (error) {
            req.log.error({
                requestId: logRequestId,
                tenantId,
                userId,
                instantRequestId: requestId,
                error: error instanceof Error ? error.message : String(error),
                'work-instant.action': 'accept-error',
                source: 'instant_mode',
            }, 'Error accepting instant service request');
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('not pending') || error.message.includes('expired') || error.message.includes('already accepted')) {
                    return reply.status(409).send({ error: error.message });
                }
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Failed to accept request' });
        }
    });
    /**
     * POST /work/instant/:requestId/cancel
     * Customer cancela uma solicitação
     * Apenas o customer que criou pode cancelar
     */
    fastify.post('/:requestId/cancel', {
        preHandler: fastify.requirePermission(['work:instant:cancel']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { requestId } = req.params;
        const logRequestId = req.requestId || req.id;
        req.log.info({
            requestId: logRequestId,
            tenantId,
            userId,
            instantRequestId: requestId,
            'work-instant.action': 'cancel',
            source: 'instant_mode',
        }, 'Customer cancelling instant service request');
        try {
            const request = await instant_service_1.instantService.cancelRequest(tenantId, requestId, userId);
            req.log.info({
                requestId: logRequestId,
                tenantId,
                userId,
                instantRequestId: requestId,
                'work-instant.action': 'request-cancelled',
                source: 'instant_mode',
            }, 'Instant service request cancelled successfully');
            return reply.status(200).send({
                request,
                message: 'Request cancelled successfully',
            });
        }
        catch (error) {
            req.log.error({
                requestId: logRequestId,
                tenantId,
                userId,
                instantRequestId: requestId,
                error: error instanceof Error ? error.message : String(error),
                'work-instant.action': 'cancel-error',
                source: 'instant_mode',
            }, 'Error cancelling instant service request');
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('Only the customer') || error.message.includes('Cannot cancel')) {
                    return reply.status(403).send({ error: error.message });
                }
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Failed to cancel request' });
        }
    });
    /**
     * GET /work/instant/:requestId
     * Busca status de uma request
     */
    fastify.get('/:requestId', {
        preHandler: fastify.requirePermission(['work:instant:read']),
    }, async (req, reply) => {
        const { requestId } = req.params;
        const request = await instant_service_1.instantService.getRequest(requestId);
        if (!request) {
            return reply.status(404).send({ error: 'Request not found' });
        }
        return request;
    });
};
exports.default = instantRoutes;
