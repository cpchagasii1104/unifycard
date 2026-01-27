// src/core/notify/notify.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { notifyService } from './notify.service';
import {
  notificationIdSchema,
  enqueueNotificationSchema,
  listNotificationsQuerySchema,
  pushToUserSchema,
  emailToTargetSchema,
} from './notify.schemas';

const notifyRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /notify/enqueue - Enfileirar notificação genérica
  fastify.post('/enqueue', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['notify:create'])(req, reply);

    const parsed = enqueueNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const notification = await notifyService.enqueue({
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
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /notify/push - Enviar push para usuário
  fastify.post('/push', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['notify:create'])(req, reply);

    const parsed = pushToUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const notification = await notifyService.pushToUser(
        tenantId,
        parsed.data.userId,
        {
          title: parsed.data.title,
          body: parsed.data.body,
          data: parsed.data.data,
        },
        {
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
          maxRetries: parsed.data.maxRetries,
        }
      );
      return reply.status(201).send(notification);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /notify/email - Enviar email
  fastify.post('/email', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['notify:create'])(req, reply);

    const parsed = emailToTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const notification = await notifyService.emailToTarget(
        tenantId,
        parsed.data.targetEmail,
        {
          subject: parsed.data.subject,
          body: parsed.data.body,
        },
        {
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
          maxRetries: parsed.data.maxRetries,
        }
      );
      return reply.status(201).send(notification);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /notify - Listar notificações
  fastify.get('/', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['notify:read'])(req, reply);

    const parsed = listNotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    const { status, limit, offset } = parsed.data;
    const notifications = await notifyService.list(tenantId, status, limit, offset);
    return { notifications };
  });

  // GET /notify/:notificationId - Buscar notificação por ID
  fastify.get<{ Params: { notificationId: string } }>('/:notificationId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['notify:read'])(req, reply);

    const parsed = notificationIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid notification ID',
        details: parsed.error.errors,
      });
    }

    const notification = await notifyService.getById(tenantId, parsed.data.notificationId);

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    return notification;
  });

  // POST /notify/:notificationId/retry - Retry notificação falha
  fastify.post<{ Params: { notificationId: string } }>(
    '/:notificationId/retry',
    async (req, reply) => {
      const tenantId = req.tenant!.id;

      await fastify.requirePermission(['notify:retry'])(req, reply);

      const parsed = notificationIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid notification ID',
          details: parsed.error.errors,
        });
      }

      const notification = await notifyService.retryNotification(
        tenantId,
        parsed.data.notificationId
      );

      if (!notification) {
        return reply.status(404).send({ error: 'Notification not found' });
      }

      return notification;
    }
  );

  // POST /notify/process - Processar notificações pendentes (admin/worker)
  fastify.post('/process', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['notify:process'])(req, reply);

    try {
      const processed = await notifyService.processPendingForTenant(tenantId, { limit: 50 });
      return { processed };
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });
};

export default notifyRoutes;
