// src/modules/inbox/social-inbox.routes.ts
// Rotas do Domínio de INBOX SOCIAL DE AÇÕES
// 🔴 BLINDAGEM: Endpoints mínimos (leitura, marcação, arquivamento)
// 🔴 BLINDAGEM: NÃO cria decisão, NÃO executa ação, NÃO altera estado de domínio

import { FastifyPluginAsync } from 'fastify';
import { socialInboxService } from './social-inbox.service';
import { InboxItemStatus, InboxSourceType } from './social-inbox.types';
import rateLimit from '@fastify/rate-limit';

const socialInboxRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔴 HARDENING: Rate limiting para rotas sensíveis de inbox
  await fastify.register(rateLimit as any, {
    max: 100, // 100 requests/min
    timeWindow: '1 minute',
    skipOnError: false,
  });
  /**
   * GET /inbox/actors/:id
   * Buscar items do inbox de um actor
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   * 🔴 BLINDAGEM: NUNCA ordenar por score ou importância
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      status?: string;
      sourceType?: string;
    };
  }>('/actors/:id', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const filters: any = {};

      if (req.query.status) {
        filters.status = req.query.status as InboxItemStatus;
      }

      if (req.query.sourceType) {
        filters.sourceType = req.query.sourceType as InboxSourceType;
      }

      const items = await socialInboxService.getInboxItems(
        req.tenant.id,
        req.params.id,
        filters
      );

      return reply.send({
        ok: true,
        data: items.map(item => ({
          inboxItemId: item.inboxItemId,
          actorId: item.actorId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          status: item.status,
          createdAt: item.createdAt,
          readAt: item.readAt,
          archivedAt: item.archivedAt,
          metadata: item.metadata,
        })),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * GET /inbox/actors/:id/counter
   * Buscar contador de inbox de um actor
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   */
  fastify.get<{ Params: { id: string } }>('/actors/:id/counter', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const counter = await socialInboxService.getInboxCounter(
        req.tenant.id,
        req.params.id
      );

      return reply.send({ ok: true, data: counter });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * POST /inbox/:itemId/read
   * Marcar item do inbox como lido
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   * 🔴 BLINDAGEM: NÃO cria ação automática
   */
  fastify.post<{ Params: { itemId: string } }>('/:itemId/read', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const item = await socialInboxService.markAsRead(
        req.tenant.id,
        req.params.itemId,
        req.actionContext.actorId
      );

      return reply.send({
        inboxItemId: item.inboxItemId,
        status: item.status,
        readAt: item.readAt?.toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });

  /**
   * POST /inbox/:itemId/archive
   * Arquivar item do inbox
   * 🔴 BLINDAGEM: Apenas organização, não decisão
   * 🔴 BLINDAGEM: NÃO cria ação automática
   */
  fastify.post<{ Params: { itemId: string } }>('/:itemId/archive', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const item = await socialInboxService.archive(
        req.tenant.id,
        req.params.itemId,
        req.actionContext.actorId
      );

      return reply.send({
        inboxItemId: item.inboxItemId,
        status: item.status,
        archivedAt: item.archivedAt?.toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({ error: error.message });
    }
  });
};

export { socialInboxRoutes };

