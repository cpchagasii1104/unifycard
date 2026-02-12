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
  }, async (req) => {
    // Validação manual com Zod
    const params = entityParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { entityType, entityId } = params;

    const score = await reputationService.getScore(tenantId, entityType, entityId);

    return {
      entityType,
      entityId,
      score,
    };
  });
};

export default reputationRoutes;
