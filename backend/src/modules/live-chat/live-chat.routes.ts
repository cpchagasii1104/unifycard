// backend/src/modules/live-chat/live-chat.routes.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import type { FastifyInstance } from 'fastify';
import { livePresenceService } from './live-presence.service';
import { chatService } from './chat.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

/**
 * Rotas REST para Live Chat
 */
const liveChatRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /live/presence/opt-in
   * Opt-in para presença ao vivo
   */
  fastify.post<{
    Body: {
      contextType: 'EVENT' | 'VENUE';
      contextId: string;
      contactId: string;
    };
  }>('/presence/opt-in', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId, contactId } = req.body;

    const presence = await livePresenceService.optIn(tenantId, {
      contextType,
      contextId,
      contactId,
    });

    return reply.status(201).send(presence);
  });

  /**
   * POST /live/presence/opt-out
   * Opt-out de presença ao vivo
   */
  fastify.post<{
    Body: {
      contextType: 'EVENT' | 'VENUE';
      contextId: string;
      contactId: string;
    };
  }>('/presence/opt-out', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId, contactId } = req.body;

    const presence = await livePresenceService.optOut(tenantId, contextType, contextId, contactId);

    return reply.send(presence);
  });

  /**
   * POST /live/presence/heartbeat
   * Heartbeat para manter presença online
   */
  fastify.post<{
    Body: {
      contextType: 'EVENT' | 'VENUE';
      contextId: string;
      contactId: string;
    };
  }>('/presence/heartbeat', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId, contactId } = req.body;

    const presence = await livePresenceService.heartbeat(tenantId, contextType, contextId, contactId);

    return reply.send(presence);
  });

  /**
   * GET /live/presence/:contextType/:contextId/online
   * Lista quem está online (apenas opt-in)
   */
  fastify.get<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
    Querystring: { limit?: number };
  }>('/presence/:contextType/:contextId/online', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const online = await livePresenceService.listOnline(tenantId, contextType, contextId, limit);

    return reply.send({ online });
  });

  /**
   * GET /live-chat/:contextType/:contextId/room
   * Busca ou cria sala de chat
   */
  fastify.get<{
    Params: { contextType: 'EVENT' | 'VENUE'; contextId: string };
  }>('/:contextType/:contextId/room', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { contextType, contextId } = req.params;

    const room = await chatService.getOrCreateRoom(tenantId, contextType, contextId);

    return reply.send(room);
  });

  /**
   * GET /live-chat/rooms/:roomId/messages
   * Lista mensagens (com filtro de bloqueios)
   */
  fastify.get<{
    Params: { roomId: string };
    Querystring: {
      viewerContactId: string;
      cursor?: string;
      limit?: number;
    };
  }>('/rooms/:roomId/messages', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { roomId } = req.params;
    const { viewerContactId, cursor, limit } = req.query;

    if (!viewerContactId) {
      return reply.status(400).send({ error: 'viewerContactId é obrigatório' });
    }

    const messages = await chatService.listMessages(
      tenantId,
      roomId,
      viewerContactId,
      cursor || null,
      limit ? parseInt(limit as string, 10) : 50
    );

    return reply.send({ messages });
  });

  /**
   * POST /live-chat/rooms/:roomId/messages
   * Envia mensagem
   */
  fastify.post<{
    Params: { roomId: string };
    Body: {
      contactId: string;
      content: string;
      clientMessageId?: string;
    };
  }>('/rooms/:roomId/messages', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { roomId } = req.params;
    const { contactId, content, clientMessageId } = req.body;

    const message = await chatService.sendMessage(tenantId, {
      roomId,
      contactId,
      content,
      clientMessageId: clientMessageId || null,
    });

    return reply.status(201).send(message);
  });

  /**
   * POST /live-chat/messages/:id/delete
   * Deleta própria mensagem
   */
  fastify.post<{
    Params: { id: string };
    Body: { contactId: string };
  }>('/messages/:id/delete', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const messageId = req.params.id;
    const { contactId } = req.body;

    await chatService.deleteOwnMessage(tenantId, messageId, contactId);

    return reply.send({ success: true });
  });

  /**
   * POST /live-chat/block
   * Bloqueia contato
   */
  fastify.post<{
    Body: {
      blockerContactId: string;
      blockedContactId: string;
      contextType: 'EVENT' | 'VENUE';
      contextId: string;
    };
  }>('/block', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { blockerContactId, blockedContactId, contextType, contextId } = req.body;

    const block = await chatService.blockContact(tenantId, {
      blockerContactId,
      blockedContactId,
      contextType,
      contextId,
    });

    return reply.status(201).send(block);
  });

  /**
   * POST /live-chat/report
   * Denuncia contato
   */
  fastify.post<{
    Body: {
      reporterContactId: string;
      reportedContactId: string;
      roomId: string;
      messageId?: string;
      reasonCode: 'SPAM' | 'HARASSMENT' | 'HATE' | 'SEXUAL' | 'OTHER';
      details?: string;
    };
  }>('/report', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { reporterContactId, reportedContactId, roomId, messageId, reasonCode, details } = req.body;

    const report = await chatService.reportContact(tenantId, {
      reporterContactId,
      reportedContactId,
      roomId,
      messageId: messageId || null,
      reasonCode,
      details: details || null,
    });

    return reply.status(201).send(report);
  });

  /**
   * POST /live-chat/rooms/:id/archive
   * Arquiva sala (admin)
   */
  fastify.post<{
    Params: { id: string };
  }>('/rooms/:id/archive', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const roomId = req.params.id;

    await chatService.archiveRoom(tenantId, roomId);

    return reply.send({ success: true });
  });
};

export default liveChatRoutes;

