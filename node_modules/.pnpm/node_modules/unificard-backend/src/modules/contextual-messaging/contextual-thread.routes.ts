// backend/src/modules/contextual-messaging/contextual-thread.routes.ts
// Rotas para Mensageria Contextual
// 🔴 BLINDAGEM: NÃO toma decisões automáticas

import { FastifyPluginAsync } from 'fastify';
import { contextualThreadService } from './contextual-thread.service';
import type {
  CreateContextualThreadInput,
  SendContextualMessageInput,
} from './contextual-thread.types';

const contextualThreadRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /contextual-threads
   * Criar nova thread contextual
   */
  fastify.post<{ Body: CreateContextualThreadInput }>(
    '/contextual-threads',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingActorId) {
        return reply.status(400).send({ error: 'actingActorId é obrigatório' });
      }

      try {
        const thread = await contextualThreadService.createThread(tenantId, req.body);
        return reply.status(201).send(thread);
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao criar thread contextual');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao criar thread contextual',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /contextual-threads
   * Listar threads com filtros
   */
  fastify.get<{
    Querystring: {
      contextType?: string;
      contextId?: string;
      participantActorId?: string;
      limit?: number;
      offset?: number;
    };
  }>('/contextual-threads', async (req, reply) => {
    const tenantId = req.tenant!.id;

    try {
      const result = await contextualThreadService.listThreads(tenantId, {
        contextType: req.query.contextType as any,
        contextId: req.query.contextId,
        participantActorId: req.query.participantActorId,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar threads contextuais');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao listar threads contextuais',
        message: error.message,
      });
    }
  });

  /**
   * GET /contextual-threads/:threadId
   * Buscar thread por ID
   */
  fastify.get<{ Params: { threadId: string } }>(
    '/contextual-threads/:threadId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { threadId } = req.params;

      try {
        const thread = await contextualThreadService.getThreadById(tenantId, threadId);
        return thread;
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao buscar thread contextual');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao buscar thread contextual',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /contextual-threads/context/:contextType/:contextId
   * Buscar thread por contexto
   */
  fastify.get<{ Params: { contextType: string; contextId: string } }>(
    '/contextual-threads/context/:contextType/:contextId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { contextType, contextId } = req.params;

      try {
        const thread = await contextualThreadService.getThreadByContext(
          tenantId,
          contextType,
          contextId
        );
        if (!thread) {
          return reply.status(404).send({ error: 'Thread não encontrada' });
        }
        return thread;
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao buscar thread por contexto');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao buscar thread por contexto',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /contextual-threads/:threadId/participants
   * Adicionar participante à thread
   */
  fastify.post<{ Params: { threadId: string }; Body: { actorId: string } }>(
    '/contextual-threads/:threadId/participants',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { threadId } = req.params;
      const { actorId } = req.body;

      try {
        const thread = await contextualThreadService.addParticipant(tenantId, threadId, actorId);
        return thread;
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao adicionar participante');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao adicionar participante',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /contextual-threads/:threadId/messages
   * Enviar mensagem em thread
   */
  fastify.post<{ Params: { threadId: string }; Body: SendContextualMessageInput }>(
    '/contextual-threads/:threadId/messages',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { threadId } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingActorId) {
        return reply.status(400).send({ error: 'actingActorId é obrigatório' });
      }

      try {
        const message = await contextualThreadService.sendMessage(
          tenantId,
          threadId,
          req.body,
          actionContext.actingActorId,
          actionContext.actingUserId
        );
        return reply.status(201).send(message);
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao enviar mensagem');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao enviar mensagem',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /contextual-threads/:threadId/messages
   * Listar mensagens de uma thread
   */
  fastify.get<{
    Params: { threadId: string };
    Querystring: { limit?: number; offset?: number };
  }>('/contextual-threads/:threadId/messages', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { threadId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset.toString(), 10) : 0;

    try {
      const result = await contextualThreadService.getMessages(tenantId, threadId, limit, offset);
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar mensagens');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao listar mensagens',
        message: error.message,
      });
    }
  });
};

export default contextualThreadRoutes;




