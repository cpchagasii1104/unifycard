// src/modules/social/social.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { socialService } from './social.service';
import type { CreatePostInput } from './social.types';
import { createPostSchema } from './social.schemas';

const socialRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /social/posts/create
   * Cria um novo post com análise automática de intent e categorias
   */
  fastify.post<{
    Body: {
      content: string;
      media?: Array<{
        type: 'image' | 'video' | 'audio';
        url: string;
        thumbnailUrl?: string;
        duration?: number;
        metadata?: Record<string, any>;
      }>;
      metadata?: Record<string, any>;
      categories?: string[];
      intent?: string;
      // Campos para posts de serviços
      serviceInfo?: {
        categoryId?: string;
        categoryName?: string;
        price?: number;
        pricingType?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote';
        currency?: string;
        description?: string;
        duration?: number;
        requiresSchedule?: boolean;
        requiresPayment?: boolean;
      };
      isServicePost?: boolean;
    };
  }>(
    '/posts/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string' },
            media: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['image', 'video', 'audio'] },
                  url: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  duration: { type: 'number' },
                  metadata: { type: 'object' },
                },
              },
            },
            metadata: { type: 'object' },
            categories: {
              type: 'array',
              items: { type: 'string' },
            },
            intent: { type: 'string' },
            serviceInfo: {
              type: 'object',
              properties: {
                categoryId: { type: 'string' },
                categoryName: { type: 'string' },
                price: { type: 'number' },
                pricingType: { type: 'string', enum: ['hourly', 'daily', 'weekly', 'monthly', 'quote'] },
                currency: { type: 'string' },
                description: { type: 'string' },
                duration: { type: 'number' },
                requiresSchedule: { type: 'boolean' },
                requiresPayment: { type: 'boolean' },
              },
            },
            isServicePost: { type: 'boolean' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = createPostSchema.parse(req.body);
        const post = await socialService.createPost(
          req.server,
          req.tenant.id,
          req.actionContext.actorId,
          validated as CreatePostInput
        );
        return reply.status(201).send(post);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao criar post');
        return reply.status(500).send({ error: 'Erro ao criar post' });
      }
    }
  );

  /**
   * GET /social/posts/:postId
   * Busca um post por ID
   */
  fastify.get<{
    Params: { postId: string };
  }>(
    '/posts/:postId',
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
        const post = await socialService.getPost(req.tenant.id, req.params.postId);

        if (!post) {
          return reply.status(404).send({ error: 'Post não encontrado' });
        }

        return post;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar post');
        return reply.status(500).send({ error: 'Erro ao buscar post' });
      }
    }
  );

  // NOTA: GET /social/feed foi movido para social-2.0.routes.ts (canônico)
  // Esta rota antiga foi removida para evitar duplicação

  /**
   * GET /social/unread-counts
   * Retorna contadores de novidade para o menu social
   * Mesma lógica de /feed/unread-counts (mantida aqui para compatibilidade)
   */
  fastify.get('/unread-counts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;

    try {
      const { runQueryWithTenant } = await import('@core/database/pool');
      
      // Feed: posts das últimas 24h
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const feedCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM posts
        WHERE tenant_id = $1
          AND createdAt >= $2
          AND visibility = 'PUBLIC'
        `,
        [tenantId, oneDayAgo]
      );

      // Grupos: grupos com atividade recente (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const groupsCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(DISTINCT metadata->>'groupId')::int as count
        FROM posts
        WHERE tenant_id = $1
          AND metadata->>'groupId' IS NOT NULL
          AND createdAt >= $2
        `,
        [tenantId, sevenDaysAgo]
      );

      // Eventos: eventos próximos (próximos 7 dias)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const eventsCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM events
        WHERE tenant_id = $1
          AND status IN ('published', 'ongoing')
          AND starts_at >= NOW()
          AND starts_at <= $2
        `,
        [tenantId, sevenDaysFromNow]
      );

      // Serviços: ofertas de serviço recentes (últimos 7 dias)
      const servicesCount = await runQueryWithTenant<{ count: string }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM posts
        WHERE tenant_id = $1
          AND intent = 'service_offer'
          AND createdAt >= $2
        `,
        [tenantId, sevenDaysAgo]
      );

      return {
        feed: feedCount ? Number(feedCount.count) : 0,
        groups: groupsCount ? Number(groupsCount.count) : 0,
        events: eventsCount ? Number(eventsCount.count) : 0,
        services: servicesCount ? Number(servicesCount.count) : 0,
      };
    } catch (error) {
      fastify.log.error({ err: error, tenantId }, 'Erro ao buscar contadores de novidade');
      // Retornar zeros em caso de erro (não quebrar UI)
      return {
        feed: 0,
        groups: 0,
        events: 0,
        services: 0,
      };
    }
  });
};

export default socialRoutes;









