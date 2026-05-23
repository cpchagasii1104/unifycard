// backend/src/core/reviews/review.service.ts
import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import {
  insertEventOutboxRow,
  outboxEventIdFromSeed,
} from '@core/events/event-outbox.repository';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import type {
  ReviewRow,
  Review,
  CreateReviewInput,
  ListReviewsFilters,
} from './review.types';

class ReviewService {
  private tsIso(v: string | Date): string {
    return v instanceof Date ? v.toISOString() : String(v);
  }

  private toReview(row: ReviewRow): Review {
    return {
      reviewId: row.review_id,
      tenantId: row.tenant_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      authorUserId: row.author_user_id,
      authorGlobalUserId: row.author_global_user_id ?? undefined,
      sourceModule: row.source_module,
      rating: row.rating,
      comment: row.comment ?? undefined,
      qualityRating: row.quality_rating ?? undefined,
      punctualityRating: row.punctuality_rating ?? undefined,
      professionalismRating: row.professionalism_rating ?? undefined,
      context: (row.context ?? undefined) as any,
      createdAt: this.tsIso(row.created_at),
      updatedAt: this.tsIso(row.updated_at),
    };
  }

  async getById(tenantId: string, reviewId: string): Promise<Review | null> {
    const row = await runQueryWithTenant<ReviewRow>(
      tenantId,
      `SELECT review_id, tenant_id, entity_type, entity_id, author_user_id, author_global_user_id, source_module, rating, comment, quality_rating, punctuality_rating, professionalism_rating, context, created_at, updated_at FROM reviews WHERE review_id = $1`,
      [reviewId],
    );
    return row ? this.toReview(row) : null;
  }

  async createReview(
    tenantId: string,
    authorUserId: string,
    sourceModule: string,
    input: CreateReviewInput,
  ): Promise<Review> {
    // Resolver global_user_id do autor
    const authorGlobalUserId = await resolveGlobalUserId(authorUserId, tenantId);

    const row = await runQueryWithTenant<ReviewRow>(
      tenantId,
      `
      INSERT INTO reviews (
        tenant_id,
        entity_type,
        entity_id,
        author_user_id,
        author_global_user_id,
        source_module,
        rating,
        comment,
        quality_rating,
        punctuality_rating,
        professionalism_rating,
        context
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        tenantId,
        input.entityType,
        input.entityId,
        authorUserId,
        authorGlobalUserId,
        sourceModule,
        input.rating,
        input.comment ?? null,
        input.qualityRating ?? null,
        input.punctualityRating ?? null,
        input.professionalismRating ?? null,
        input.context ?? null,
      ],
    );

    if (!row) {
      throw new Error('Failed to create review');
    }

    const review = this.toReview(row);

    // Evento genérico de review criada (transversal)
    const outboxClient = await getClientWithTenant(tenantId);
    try {
      await outboxClient.query('BEGIN');
      await insertEventOutboxRow(outboxClient, {
        tenantId,
        eventId: outboxEventIdFromSeed(`core.review.created:${tenantId}:${review.reviewId}`),
        eventType: 'core.review.created',
        eventVersion: 1,
        payload: {
          reviewId: review.reviewId,
          entityType: review.entityType,
          entityId: review.entityId,
          authorUserId: review.authorUserId,
          rating: review.rating,
          qualityRating: review.qualityRating,
          punctualityRating: review.punctualityRating,
          professionalismRating: review.professionalismRating,
          sourceModule,
        },
      });
      await outboxClient.query('COMMIT');
    } catch (err) {
      await outboxClient.query('ROLLBACK');
      throw err;
    } finally {
      outboxClient.release();
    }

    return review;
  }

  async listReviews(
    tenantId: string,
    filters: ListReviewsFilters,
  ): Promise<{ reviews: Review[]; totalCents: number }> {
    const { entityType, entityId, authorUserId, limit = 50, offset = 0 } =
      filters;

    const params: any[] = [tenantId];
    let i = 2;
    const where: string[] = ['tenant_id = $1'];

    if (entityType) {
      where.push(`entity_type = $${i}`);
      params.push(entityType);
      i++;
    }

    if (entityId) {
      where.push(`entity_id = $${i}`);
      params.push(entityId);
      i++;
    }

    if (authorUserId) {
      where.push(`author_user_id = $${i}`);
      params.push(authorUserId);
      i++;
    }

    const whereSQL = where.join(' AND ');

    const rows = await runQueriesWithTenant<ReviewRow>(
      tenantId,
      `
      SELECT review_id, tenant_id, entity_type, entity_id, author_user_id, author_global_user_id, source_module, rating, comment, quality_rating, punctuality_rating, professionalism_rating, context, created_at, updated_at
      FROM reviews
      WHERE ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...params, limit, offset],
    );

    const count = await runQueryWithTenant<{ total: string }>(
      tenantId,
      `SELECT COUNT(*)::text AS total FROM reviews WHERE ${whereSQL}`,
      params,
    );

    if (!count) {
      throw new Error('Failed to count reviews');
    }

    return {
      reviews: rows.map(r => this.toReview(r)),
      totalCents: Number(count.total),
    };
  }
}

export const reviewService = new ReviewService();


