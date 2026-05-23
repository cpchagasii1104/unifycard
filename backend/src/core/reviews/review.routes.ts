// src/core/reviews/review.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { NotFoundError } from '@core/errors';
import { reviewService } from './review.service';
import {
  createReviewSchema,
  reviewIdParamsSchema,
  listReviewsQuerySchema,
} from './review.schemas';
import { z } from 'zod';

const reviewRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /reviews
   * Criar review universal
   */
  fastify.post<{
    Body: z.infer<typeof createReviewSchema>;
    Querystring: { sourceModule?: string };
  }>('/', {
    preHandler: fastify.requirePermission(['reviews:create']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const body = createReviewSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const authorUserId = req.user!.id;
    const sourceModule = req.query.sourceModule || 'direct';

    const review = await reviewService.createReview(
      tenantId,
      authorUserId,
      sourceModule,
      body,
    );

    return reply.status(201).send(review);
  });

  /**
   * GET /reviews
   * Listar reviews com filtros
   */
  fastify.get<{
    Querystring: z.infer<typeof listReviewsQuerySchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['reviews:read']),
  }, async (req) => {
    // Validação manual com Zod
    const query = listReviewsQuerySchema.parse(req.query);
    const tenantId = req.tenant!.id;
    const result = await reviewService.listReviews(tenantId, query);
    return result;
  });

  /**
   * GET /reviews/:reviewId
   * Buscar review por ID
   */
  fastify.get<{
    Params: z.infer<typeof reviewIdParamsSchema>;
  }>('/:reviewId', {
    preHandler: fastify.requirePermission(['reviews:read']),
  }, async (req) => {
    // Validação manual com Zod
    const params = reviewIdParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { reviewId } = params;

    const review = await reviewService.getById(tenantId, reviewId);

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    return review;
  });
};

export default reviewRoutes;
