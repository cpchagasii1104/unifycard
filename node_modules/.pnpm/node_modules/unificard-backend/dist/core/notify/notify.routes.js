"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notify_service_1 = require("./notify.service");
const notify_schemas_1 = require("./notify.schemas");
const notifyRoutes = async (fastify) => {
    // POST /notify/enqueue - Enfileirar notificação genérica
    fastify.post('/enqueue', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:create'])(req, reply);
        const parsed = notify_schemas_1.enqueueNotificationSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const notification = await notify_service_1.notifyService.enqueue({
                tenantId,
                userId: parsed.data.userId ?? null,
                channel: parsed.data.channel,
                templateName: parsed.data.templateName ?? null,
                target: parsed.data.target,
                payload: parsed.data.payload ?? {},
                scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
                maxRetries: parsed.data.maxRetries,
            });
            return reply.status(201).send(notification);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // POST /notify/push - Enviar push para usuário
    fastify.post('/push', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:create'])(req, reply);
        const parsed = notify_schemas_1.pushToUserSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const notification = await notify_service_1.notifyService.pushToUser(tenantId, parsed.data.userId, {
                title: parsed.data.title,
                body: parsed.data.body,
                data: parsed.data.data,
            }, {
                scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
                maxRetries: parsed.data.maxRetries,
            });
            return reply.status(201).send(notification);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // POST /notify/email - Enviar email
    fastify.post('/email', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:create'])(req, reply);
        const parsed = notify_schemas_1.emailToTargetSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const notification = await notify_service_1.notifyService.emailToTarget(tenantId, parsed.data.targetEmail, {
                subject: parsed.data.subject,
                body: parsed.data.body,
            }, {
                scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
                maxRetries: parsed.data.maxRetries,
            });
            return reply.status(201).send(notification);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // GET /notify - Listar notificações
    fastify.get('/', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:read'])(req, reply);
        const parsed = notify_schemas_1.listNotificationsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        const { status, limit, offset } = parsed.data;
        const notifications = await notify_service_1.notifyService.list(tenantId, status, limit, offset);
        return { notifications };
    });
    // GET /notify/:notificationId - Buscar notificação por ID
    fastify.get('/:notificationId', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:read'])(req, reply);
        const parsed = notify_schemas_1.notificationIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid notification ID',
                details: parsed.error.errors,
            });
        }
        const notification = await notify_service_1.notifyService.getById(tenantId, parsed.data.notificationId);
        if (!notification) {
            return reply.status(404).send({ error: 'Notification not found' });
        }
        return notification;
    });
    // POST /notify/:notificationId/retry - Retry notificação falha
    fastify.post('/:notificationId/retry', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:retry'])(req, reply);
        const parsed = notify_schemas_1.notificationIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid notification ID',
                details: parsed.error.errors,
            });
        }
        const notification = await notify_service_1.notifyService.retryNotification(tenantId, parsed.data.notificationId);
        if (!notification) {
            return reply.status(404).send({ error: 'Notification not found' });
        }
        return notification;
    });
    // POST /notify/process - Processar notificações pendentes (admin/worker)
    fastify.post('/process', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['notify:process'])(req, reply);
        try {
            const processed = await notify_service_1.notifyService.processPendingForTenant(tenantId, { limit: 50 });
            return { processed };
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
};
exports.default = notifyRoutes;
