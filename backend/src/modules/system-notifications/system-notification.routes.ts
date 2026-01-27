// backend/src/modules/system-notifications/system-notification.routes.ts
// Rotas para Notificações In-App
// 🔴 BLINDAGEM: NÃO executa ações automaticamente

import { FastifyPluginAsync } from 'fastify';
import { systemNotificationService } from './system-notification.service';
import type { SystemNotificationFilters } from './system-notification.types';

const systemNotificationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /system-notifications
   * Listar notificações com filtros
   */
  fastify.get<{
    Querystring: {
      recipientActorId?: string;
      type?: string;
      contextType?: string;
      contextId?: string;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    };
  }>('/system-notifications', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // Se recipientActorId não for fornecido, usar o actor ativo
    const recipientActorId = req.query.recipientActorId || actionContext?.actingActorId;

    if (!recipientActorId) {
      return reply.status(400).send({ error: 'recipientActorId é obrigatório' });
    }

    try {
      const filters: SystemNotificationFilters = {
        recipientActorId,
        type: req.query.type as any,
        contextType: req.query.contextType as any,
        contextId: req.query.contextId,
        unreadOnly: req.query.unreadOnly === 'true' || req.query.unreadOnly === true,
        limit: req.query.limit ? parseInt(req.query.limit.toString(), 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset.toString(), 10) : undefined,
      };

      const result = await systemNotificationService.listNotifications(tenantId, filters);
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar notificações');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao listar notificações',
        message: error.message,
      });
    }
  });

  /**
   * GET /system-notifications/unread-count
   * Contar notificações não lidas
   */
  fastify.get<{
    Querystring: {
      recipientActorId?: string;
    };
  }>('/system-notifications/unread-count', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    const recipientActorId = req.query.recipientActorId || actionContext?.actingActorId;

    if (!recipientActorId) {
      return reply.status(400).send({ error: 'recipientActorId é obrigatório' });
    }

    try {
      const count = await systemNotificationService.countUnread(tenantId, recipientActorId);
      return { count };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao contar notificações não lidas');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao contar notificações não lidas',
        message: error.message,
      });
    }
  });

  /**
   * GET /system-notifications/:notificationId
   * Buscar notificação por ID
   */
  fastify.get<{ Params: { notificationId: string } }>(
    '/system-notifications/:notificationId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { notificationId } = req.params;

      try {
        const notification = await systemNotificationService.getNotificationById(
          tenantId,
          notificationId
        );
        return notification;
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao buscar notificação');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao buscar notificação',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /system-notifications/:notificationId/read
   * Marcar notificação como lida
   */
  fastify.post<{ Params: { notificationId: string } }>(
    '/system-notifications/:notificationId/read',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { notificationId } = req.params;

      try {
        const notification = await systemNotificationService.markAsRead(tenantId, notificationId);
        return notification;
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao marcar notificação como lida');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao marcar notificação como lida',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /system-notifications/mark-all-read
   * Marcar todas as notificações como lidas
   */
  fastify.post<{
    Body: {
      recipientActorId?: string;
    };
  }>('/system-notifications/mark-all-read', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    const recipientActorId = req.body.recipientActorId || actionContext?.actingActorId;

    if (!recipientActorId) {
      return reply.status(400).send({ error: 'recipientActorId é obrigatório' });
    }

    try {
      const result = await systemNotificationService.markAllAsRead(tenantId, recipientActorId);
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao marcar todas as notificações como lidas');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao marcar todas as notificações como lidas',
        message: error.message,
      });
    }
  });
};

export default systemNotificationRoutes;




