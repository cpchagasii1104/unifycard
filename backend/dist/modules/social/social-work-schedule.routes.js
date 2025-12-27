"use strict";
// src/modules/social/social-work-schedule.routes.ts
//
// Rotas para agendar serviços publicados em posts sociais
// Integra Social + Work + Schedule
Object.defineProperty(exports, "__esModule", { value: true });
const social_work_schedule_service_1 = require("./social-work-schedule.service");
const rbac_service_1 = require("@core/rbac/rbac.service");
const zod_1 = require("zod");
const scheduleFromPostSchema = zod_1.z.object({
    startTime: zod_1.z.string().datetime(),
    endTime: zod_1.z.string().datetime(),
});
const socialWorkScheduleRoutes = async (fastify) => {
    /**
     * POST /social/work/posts/:postId/schedule
     * Cria um agendamento (schedule) a partir de um post
     * Qualquer usuário autenticado pode agendar
     */
    fastify.post('/posts/:postId/schedule', {
        preHandler: fastify.requirePermission(['schedule:create', 'social:post:read']),
        schema: {
            params: {
                type: 'object',
                properties: {
                    postId: { type: 'string', format: 'uuid' },
                },
            },
            body: {
                type: 'object',
                required: ['startTime', 'endTime'],
                properties: {
                    startTime: { type: 'string', format: 'date-time' },
                    endTime: { type: 'string', format: 'date-time' },
                },
            },
        },
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const globalUserId = req.user.globalUserId;
        const { postId } = req.params;
        const requestId = req.requestId || req.id;
        if (!globalUserId) {
            return reply.status(401).send({ error: 'Global user ID required' });
        }
        // Validar body
        const validated = scheduleFromPostSchema.parse(req.body);
        const startTime = new Date(validated.startTime);
        const endTime = new Date(validated.endTime);
        // Validar que endTime > startTime
        if (endTime <= startTime) {
            return reply.status(400).send({
                error: 'End time must be after start time',
            });
        }
        req.log.info({
            requestId,
            tenantId,
            userId,
            globalUserId,
            'social-work.action': 'schedule-service-from-post',
            postId,
            startTime: validated.startTime,
            endTime: validated.endTime,
            source: 'social_post',
        }, 'Creating schedule from social post');
        try {
            // Resolver job para obter jobId
            const job = await social_work_schedule_service_1.socialWorkScheduleService.resolveJobFromPost(postId, tenantId);
            if (!job) {
                return reply.status(400).send({
                    error: 'Post does not have an associated job. Create a job from this post first.',
                    postId,
                });
            }
            // Criar schedule
            const slot = await social_work_schedule_service_1.socialWorkScheduleService.createScheduleFromPost(postId, tenantId, userId, startTime, endTime);
            req.log.info({
                requestId,
                tenantId,
                userId,
                globalUserId,
                'social-work.action': 'schedule-created-from-post',
                postId,
                jobId: job.jobId,
                scheduleId: slot.scheduleId,
                slotId: slot.slotId,
                startTime: validated.startTime,
                endTime: validated.endTime,
                source: 'social_post',
            }, 'Schedule created from social post successfully');
            return reply.status(201).send({
                slot,
                postId,
                jobId: job.jobId,
                message: 'Schedule created successfully from social post',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                globalUserId,
                'social-work.action': 'schedule-from-post-error',
                postId,
                error: error instanceof Error ? error.message : String(error),
            }, 'Error creating schedule from post');
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('does not have')) {
                    return reply.status(400).send({ error: error.message });
                }
                if (error.message.includes('sobrepõe')) {
                    return reply.status(409).send({ error: 'Time slot overlaps with existing slot' });
                }
            }
            return reply.status(500).send({ error: 'Failed to create schedule from post' });
        }
    });
    /**
     * GET /social/work/posts/:postId/schedules
     * Lista agendamentos vinculados ao job do post
     * Apenas OWNER ou ADMIN do tenant pode acessar
     */
    fastify.get('/posts/:postId/schedules', {
        preHandler: fastify.requirePermission(['schedule:read', 'social:post:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { postId } = req.params;
        const requestId = req.requestId || req.id;
        // Validar se é OWNER ou ADMIN
        const hasAdminRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, userId, ['admin', 'owner']);
        if (!hasAdminRole) {
            return reply.status(403).send({
                error: 'Only Owner or Admin can view schedules for jobs created from posts',
            });
        }
        req.log.info({
            requestId,
            tenantId,
            userId,
            'social-work.action': 'list-post-schedules',
            postId,
            source: 'social_post',
        }, 'Listing schedules for job from social post');
        try {
            // Resolver job para obter jobId
            const job = await social_work_schedule_service_1.socialWorkScheduleService.resolveJobFromPost(postId, tenantId);
            if (!job) {
                return reply.status(400).send({
                    error: 'Post does not have an associated job.',
                    postId,
                });
            }
            // Buscar schedules
            const slots = await social_work_schedule_service_1.socialWorkScheduleService.getSchedulesForPost(postId, tenantId);
            req.log.info({
                requestId,
                tenantId,
                userId,
                'social-work.action': 'schedules-listed-from-post',
                postId,
                jobId: job.jobId,
                count: slots.length,
                source: 'social_post',
            }, 'Schedules listed successfully');
            return {
                postId,
                jobId: job.jobId,
                schedules: slots,
                total: slots.length,
            };
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                'social-work.action': 'list-post-schedules-error',
                postId,
                error: error instanceof Error ? error.message : String(error),
            }, 'Error listing schedules from post');
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Failed to list schedules' });
        }
    });
};
exports.default = socialWorkScheduleRoutes;
//# sourceMappingURL=social-work-schedule.routes.js.map