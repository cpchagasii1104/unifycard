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
  // 🔴 DECISION-0113 F6.5.3 (mensagem privada): ler thread/mensagens exige ser PARTICIPANTE real — espelha
  // o gate de escrita do service (`sendMessage`: só participantes enviam). threadId/contextId na URL é
  // ENDEREÇO, não autorização. Gate: (1) o caller pode representar o `actionContext.actorId` declarado
  // (`canRepresentActor`); (2) esse actor está em `thread.participantActorIds`. Senão → 403 não-leak
  // (uniforme com thread inexistente). Sem participante resolvível → fail-closed.
  const assertThreadParticipant = async (
    req: any,
    reply: any,
    tenantId: string,
    thread: { participantActorIds?: string[] } | null
  ): Promise<boolean> => {
    const userId = req.user?.userId as string | undefined;
    const actorId = req.actionContext?.actorId as string | undefined;
    if (!userId) {
      reply.status(401).send({ error: 'Não autenticado' });
      return false;
    }
    if (!actorId) {
      reply.status(400).send({ error: 'ActionContext obrigatório' });
      return false;
    }
    let canRepresent = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canRepresent = await authorizationService.canRepresentActor(tenantId, userId, actorId);
    } catch {
      canRepresent = false;
    }
    if (!canRepresent) {
      reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      return false;
    }
    if (!thread || !Array.isArray(thread.participantActorIds) || !thread.participantActorIds.includes(actorId)) {
      // não-leak: thread inexistente OU caller não-participante → 403 uniforme (não revela existência).
      reply.status(403).send({ error: 'Thread não acessível' });
      return false;
    }
    return true;
  };

  /**
   * POST /contextual-threads
   * Criar nova thread contextual
   */
  fastify.post<{ Body: CreateContextualThreadInput }>(
    '/contextual-threads',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
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

    // 🔴 DECISION-0113 F6.5.3: a listagem é ESCOPADA ao actor do caller (provado representável). O filtro
    // `participantActorId` do cliente é IGNORADO (não se confia no cliente) e forçado = actionContext.actorId.
    const userId = (req as any).user?.userId as string | undefined;
    const callerActorId = (req as any).actionContext?.actorId as string | undefined;
    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!callerActorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    let canRepresent = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canRepresent = await authorizationService.canRepresentActor(tenantId, userId, callerActorId);
    } catch {
      canRepresent = false;
    }
    if (!canRepresent) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    try {
      const result = await contextualThreadService.listThreads(tenantId, {
        contextType: req.query.contextType as any,
        contextId: req.query.contextId,
        participantActorId: callerActorId, // forçado ao actor do caller (ignora filtro do cliente)
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
        if (!(await assertThreadParticipant(req, reply, tenantId, thread))) return reply;
        return thread;
      } catch (error: any) {
        // não-leak: thread inexistente (404) → 403 uniforme (igual a não-participante).
        if (error?.statusCode === 404) {
          return reply.status(403).send({ error: 'Thread não acessível' });
        }
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
        // não-leak: thread inexistente OU caller não-participante → 403 uniforme (não revela existência).
        if (!thread) {
          return reply.status(403).send({ error: 'Thread não acessível' });
        }
        if (!(await assertThreadParticipant(req, reply, tenantId, thread))) return reply;
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

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      try {
        const message = await contextualThreadService.sendMessage(
          tenantId,
          threadId,
          req.body,
          actionContext.actorId,
          actionContext.actorId
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
      // 🔴 F6.5.3: provar participação ANTES de devolver mensagens privadas (resolve a thread p/ os participantes).
      const thread = await contextualThreadService.getThreadById(tenantId, threadId);
      if (!(await assertThreadParticipant(req, reply, tenantId, thread))) return reply;
      const result = await contextualThreadService.getMessages(tenantId, threadId, limit, offset);
      return result;
    } catch (error: any) {
      // não-leak: thread inexistente (404) → 403 uniforme.
      if (error?.statusCode === 404) {
        return reply.status(403).send({ error: 'Thread não acessível' });
      }
      fastify.log.error({ err: error }, 'Erro ao listar mensagens');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao listar mensagens',
        message: error.message,
      });
    }
  });
};

export default contextualThreadRoutes;




