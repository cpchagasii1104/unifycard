// backend/src/core/reviews/review.schemas.ts
import { z } from 'zod';

export const createReviewSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional(),
  qualityRating: z.number().min(1).max(5).optional(),
  punctualityRating: z.number().min(1).max(5).optional(),
  professionalismRating: z.number().min(1).max(5).optional(),
  context: z.record(z.any()).optional(),
});

export const reviewIdParamsSchema = z.object({
  reviewId: z.string().uuid(),
});

export const listReviewsQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  authorUserId: z.string().uuid().optional(),
  limit: z.string().transform(v => (v ? parseInt(v, 10) : 50)).optional(),
  offset: z.string().transform(v => (v ? parseInt(v, 10) : 0)).optional(),
});
