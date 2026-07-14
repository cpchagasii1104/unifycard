// src/services/feed/feed.routes.ts
// 🔴 CRÍTICO: Feed é READ-ONLY, nenhuma mutation financeira
import { FastifyPluginAsync } from 'fastify';
import { EventAvailabilityPreviewService } from './EventAvailabilityPreviewService';

const availabilityPreviewService = new EventAvailabilityPreviewService();

const feedRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/feed
   * Feed principal (READ-ONLY)
   */
  // DECISION-0176 (S-CITY-1): rota de feed legada APOSENTADA. `FeedService.getFeed` era dead-at-db
  // (SELECT de colunas-fantasma post_id/type/global_user_id/media) E não compunha a casa canônica de
  // audiência (bypass latente relacional/territorial). O feed canônico vivo é GET /social/feed (social-2.0,
  // enforce por postAudiencePredicateSql). Aposentada fail-closed (410) — sem SQL de posts próprio.
  // (O availability-preview abaixo NÃO lê posts e permanece.)
  fastify.get('/', async (req, reply) => {
    if (!req.user) return reply.status(401).send({ error: 'Não autenticado' });
    return reply.status(410).send({
      error: 'Legacy feed endpoint retired. Use the canonical GET /social/feed (social 2.0).',
      code: 'SOCIAL_LEGACY_API_FEED_RETIRED',
    });
  });

  /**
   * GET /api/feed/events/:id/availability-preview
   * Preview de disponibilidade (READ-ONLY)
   * 🔴 NUNCA reserva, apenas exibe próximos slots
   */
  fastify.get<{
    Params: { id: string };
  }>('/events/:id/availability-preview', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const preview = await availabilityPreviewService.getAvailabilityPreview(
        req.params.id,
        req.tenant.id
      );

      if (!preview) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      return reply.status(200).send(preview);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao buscar preview de disponibilidade');
      return reply.status(500).send({ error: 'Erro ao buscar preview de disponibilidade' });
    }
  });
};

export default feedRoutes;





