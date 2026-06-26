// src/core/reputation/reputation.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { reputationService } from './reputation.service';
import { z } from 'zod';

const entityParamsSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
});

const reputationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /reputation/:entityType/:entityId
   * Buscar score de reputação universal
   */
  fastify.get<{
    Params: z.infer<typeof entityParamsSchema>;
  }>('/:entityType/:entityId', {
    preHandler: fastify.requirePermission(['reputation:read']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const params = entityParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { entityType, entityId } = params;

    // F-EVENTS-GHOST-CONTAINMENT: reputation_scores é GHOST no schema vivo (sem migration viva;
    // ver DT-EVENTS-REPUTATION-SCORES-GHOST). CONTENÇÃO: não vazar 500 bruto por tabela ausente.
    // 501 semântico = fonte de reputação não provisionada (decisão de modelo pendente). NÃO materializar.
    let score;
    try {
      score = await reputationService.getScore(tenantId, entityType, entityId);
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '42P01') {
        return reply.status(501).send({ error: 'Reputação indisponível: fonte não provisionada', code: 'REPUTATION_SOURCE_UNAVAILABLE' });
      }
      throw err;
    }

    return {
      entityType,
      entityId,
      score,
    };
  });
};

export default reputationRoutes;
