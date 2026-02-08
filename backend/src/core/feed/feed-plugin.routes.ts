// src/core/feed/feed-plugin.routes.ts
// Rotas do FEED PLUGIN SYSTEM
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores
// 🔴 BLINDAGEM: Rotas apenas expõem informações, não executam ações
// 🔴 BLINDAGEM: Rotas não executam ações de domínio

import { FastifyPluginAsync } from 'fastify';
import { feedPluginService } from './feed-plugin.service';
import { ActorIntent } from '@core/social/ports';
import { z } from 'zod';
import rateLimit from '@fastify/rate-limit';

const feedPluginRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔴 HARDENING: Rate limiting para rotas sensíveis de feed/plugin
  await fastify.register(rateLimit as any, {
    max: 120, // 120 requests/min (batch pode ser mais frequente)
    timeWindow: '1 minute',
    skipOnError: false,
  });
  /**
   * GET /feed/plugins
   * Listar todos os plugins registrados
   * 🔴 BLINDAGEM: Lista é apenas informação, não decisão
   */
  fastify.get('/plugins', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    try {
      const plugins = feedPluginService.listPlugins();

      return reply.send({
        ok: true,
        data: plugins.map(plugin => ({
          name: plugin.name,
          supportedIntents: plugin.supportedIntents,
        })),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /feed/posts/:postId/render
   * Renderizar item do feed para um post
   * 🔴 BLINDAGEM: Renderização é apenas transformação de dados, não execução
   */
  fastify.get<{
    Params: { postId: string };
    Querystring: {
      sourceType: string;
      intent: string;
    };
  }>('/posts/:postId/render', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    try {
      const { postId } = req.params;
      const { sourceType, intent } = req.query;

      if (!sourceType || !intent) {
        return reply.status(400).send({ 
          error: 'sourceType e intent são obrigatórios' 
        });
      }

      // 🔴 BLINDAGEM: Renderizar usando plugin (apenas transformação de dados)
      const dto = await feedPluginService.renderFeedItem(
        postId,
        sourceType,
        intent as ActorIntent
      );

      if (!dto) {
        return reply.status(404).send({ 
          error: 'Nenhum plugin encontrado para renderizar este post' 
        });
      }

      return reply.send({
        ok: true,
        data: {
          id: dto.id,
          type: dto.type,
          title: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          thumbnailUrl: dto.thumbnailUrl,
          metadata: dto.metadata,
          availableActions: dto.availableActions,
          createdAt: dto.createdAt,
          updatedAt: dto.updatedAt,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /feed/posts/:postId/actions
   * Obter ações disponíveis para um post
   * 🔴 BLINDAGEM: Ações são apenas declaração, não execução
   */
  fastify.get<{
    Params: { postId: string };
    Querystring: {
      sourceType: string;
      intent: string;
    };
  }>('/posts/:postId/actions', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    try {
      const { postId } = req.params;
      const { sourceType, intent } = req.query;

      if (!sourceType || !intent) {
        return reply.status(400).send({ 
          error: 'sourceType e intent são obrigatórios' 
        });
      }

      // 🔴 BLINDAGEM: Obter ações disponíveis (apenas declaração, não execução)
      const actions = await feedPluginService.getAvailableActions(
        postId,
        sourceType,
        intent as ActorIntent
      );

      return reply.send({
        ok: true,
        data: {
          postId,
          actions,
          // 🔴 BLINDAGEM: Ações são apenas declaração, não execução
          // Feed não executa ações de domínio
          note: 'Ações são apenas declaração. Execução deve ser feita pelo domínio correspondente.',
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * GET /feed/posts/:postId/resolve
   * Resolver plugin para um post
   * 🔴 BLINDAGEM: Resolução é apenas informação, não decisão
   */
  fastify.get<{
    Params: { postId: string };
    Querystring: {
      sourceType: string;
      intent: string;
    };
  }>('/posts/:postId/resolve', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    try {
      const { postId } = req.params;
      const { sourceType, intent } = req.query;

      if (!sourceType || !intent) {
        return reply.status(400).send({ 
          error: 'sourceType e intent são obrigatórios' 
        });
      }

      // 🔴 BLINDAGEM: Resolver plugin (apenas informação, não decisão)
      const resolution = feedPluginService.resolvePluginForPost(
        postId,
        sourceType,
        intent as ActorIntent
      );

      return reply.send({
        ok: true,
        data: {
          postId,
          resolved: resolution.resolved,
          pluginName: resolution.plugin?.name || null,
          reason: resolution.reason,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  /**
   * POST /feed/plugin/render-batch
   * Renderiza múltiplos posts em batch
   * 🔴 BLINDAGEM: Renderização é apenas transformação de dados, não execução
   * 🔴 BLINDAGEM: Batch otimiza performance, não altera comportamento
   */
  const renderBatchSchema = z.object({
    postIds: z.array(z.string().uuid()).min(1).max(100), // Limitar a 100 posts por batch
  });

  fastify.post<{
    Body: z.infer<typeof renderBatchSchema>;
  }>(
    '/render-batch',
    async (req, reply) => {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = renderBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const { postIds } = parsed.data;

        // 🔴 BLINDAGEM: Renderizar em batch (apenas transformação de dados)
        const results = await feedPluginService.renderBatch(req.tenant.id, postIds);

        // Converter Map para objeto para resposta JSON
        const response: Record<string, {
          pluginId: string | null;
          dto: any | null;
          actions: string[];
        }> = {};

        for (const [postId, result] of results.entries()) {
          response[postId] = {
            pluginId: result.pluginId,
            dto: result.dto ? {
              id: result.dto.id,
              type: result.dto.type,
              title: result.dto.title,
              description: result.dto.description,
              imageUrl: result.dto.imageUrl,
              thumbnailUrl: result.dto.thumbnailUrl,
              metadata: result.dto.metadata,
              availableActions: result.dto.availableActions,
              createdAt: result.dto.createdAt,
              updatedAt: result.dto.updatedAt,
            } : null,
            actions: result.actions,
          };
        }

        return reply.send({
          ok: true,
          data: response,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Erro ao renderizar posts em batch');
        return reply.status(500).send({ ok: false, message: 'Erro interno ao renderizar posts em batch' });
      }
    }
  );
};

export default feedPluginRoutes;

