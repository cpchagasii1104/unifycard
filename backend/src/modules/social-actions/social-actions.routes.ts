// src/modules/social-actions/social-actions.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { socialActionsService } from './social-actions.service';
import { executeActionSchema } from './social-actions.schemas';

const socialActionsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /social-actions/execute
   * Executa uma ação
   */
  fastify.post<{
    Body: {
      actionId: string;
    };
  }>(
    '/execute',
    {
      schema: {
        body: {
          type: 'object',
          required: ['actionId'],
          properties: {
            actionId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.user.globalUserId) {
        return reply.status(404).send({ error: 'Identidade global não encontrada' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = executeActionSchema.parse(req.body);
        const result = await socialActionsService.executeAction(
          req.server,
          req.tenant.id,
          validated.actionId,
          req.user.globalUserId
        );
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao executar ação');
        return reply.status(500).send({ error: 'Erro ao executar ação' });
      }
    }
  );

  /**
   * GET /social-actions/:actionId
   * Busca uma ação por ID
   */
  fastify.get<{
    Params: { actionId: string };
  }>(
    '/:actionId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            actionId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const action = await socialActionsService.getAction(
          req.tenant.id,
          req.params.actionId
        );

        if (!action) {
          return reply.status(404).send({ error: 'Ação não encontrada' });
        }

        return action;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar ação');
        return reply.status(500).send({ error: 'Erro ao buscar ação' });
      }
    }
  );

  /**
   * GET /social-actions/by-post/:postId
   * Busca todas as ações de um post
   */
  fastify.get<{
    Params: { postId: string };
  }>(
    '/by-post/:postId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            postId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const actions = await socialActionsService.getActionsByPost(
          req.tenant.id,
          req.params.postId
        );
        return { actions, totalCents: actions.length };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar ações do post');
        return reply.status(500).send({ error: 'Erro ao buscar ações do post' });
      }
    }
  );

  /**
   * POST /social-actions/:actionId/cancel
   * Cancela uma ação
   */
  fastify.post<{
    Params: { actionId: string };
  }>(
    '/:actionId/cancel',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            actionId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.user.globalUserId) {
        return reply.status(404).send({ error: 'Identidade global não encontrada' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        await socialActionsService.cancelAction(
          req.tenant.id,
          req.params.actionId,
          req.user.globalUserId
        );
        return reply.status(200).send({ success: true, message: 'Ação cancelada' });
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao cancelar ação');
        return reply.status(500).send({ error: 'Erro ao cancelar ação' });
      }
    }
  );
};

export default socialActionsRoutes;

















