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
   *
   * 🔴 F-G10-C1-PRECONDITION (DECISION-0115 D1): no tenant inicial COMPARTILHADO, RLS é por tenant,
   * não por actor/user — leituras tenant-wide vazam. Decisão de produto (GO IA Diretora/Clayton):
   * `groups` é MEMBER-SCOPED via group_members (sujeito = req.user server-side; DECISION-0113);
   * `services` conta apenas conteúdo público; `feed`/`events` continuam tenant-wide públicos por enquanto.
   */
  fastify.get('/unread-counts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.userId;

    const { runQueryWithTenant } = await import('@core/database/pool');

    // F-C1-AUTO-REACHABLE-READ-PURITY: erro estrutural NÃO vira ZERO FALSO. Cada contador é
    // isolado; falha (ex.: a query legada de `feed` referencia `posts.visibility`, coluna fantasma
    // no schema vivo — DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN) retorna **null**
    // (indisponível/honesto), NÃO 0. O frontend distingue "0 novas" (contado) de "indisponível"
    // (null). Member-scoping de groups/services segue executando.
    const countOrNull = async (counter: string, sql: string, params: unknown[]): Promise<number | null> => {
      try {
        const row = await runQueryWithTenant<{ count: string }>(tenantId, sql, params);
        return row ? Number(row.count) : 0;
      } catch (error) {
        fastify.log.error({ err: error, tenantId, counter }, 'Contador de novidade indisponível (erro estrutural)');
        return null; // indisponível — NUNCA zero falso
      }
    };

    // Feed: posts das últimas 24h (INTOCADO — tenant-wide público por decisão de produto)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const feed = await countOrNull(
      'feed',
      `
      SELECT COUNT(*)::int as count
      FROM posts
      WHERE tenant_id = $1
        AND created_at >= $2
        AND visibility = 'PUBLIC'
      `,
      [tenantId, oneDayAgo]
    );

    // Grupos: MEMBER-SCOPED via group_members — atividade de grupo só conta para quem é membro;
    // não vaza existência/atividade de grupos alheios no tenant compartilhado
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groups = await countOrNull(
      'groups',
      `
      SELECT COUNT(DISTINCT p.metadata->>'groupId')::int as count
      FROM posts p
      INNER JOIN group_members gm
        ON gm.tenant_id = p.tenant_id
       AND gm.group_id::text = p.metadata->>'groupId'
      WHERE p.tenant_id = $1
        AND p.metadata->>'groupId' IS NOT NULL
        AND p.created_at >= $2
        AND p.is_published = true
        AND p.is_deleted = false
        AND gm.user_id = $3
      `,
      [tenantId, sevenDaysAgo, userId]
    );

    // Eventos: eventos próximos (INTOCADO — tenant-wide público por decisão de produto)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const events = await countOrNull(
      'events',
      `
      SELECT COUNT(*)::int as count
      FROM events
      WHERE tenant_id = $1
        AND status IN ('published', 'active')
        AND datetime_start IS NOT NULL
        AND datetime_start >= NOW()
        AND datetime_start <= $2
      `,
      [tenantId, sevenDaysFromNow]
    );

    // Serviços: apenas conteúdo PÚBLICO — publicado, não deletado e fora de grupo (o schema vivo de
    // posts não tem `visibility` por post; a fronteira não-pública materializada hoje é o grupo)
    const services = await countOrNull(
      'services',
      `
      SELECT COUNT(*)::int as count
      FROM posts
      WHERE tenant_id = $1
        AND intent = 'service_offer'
        AND created_at >= $2
        AND is_published = true
        AND is_deleted = false
        AND metadata->>'groupId' IS NULL
      `,
      [tenantId, sevenDaysAgo]
    );

    return { feed, groups, events, services };
  });
};

export default socialRoutes;









