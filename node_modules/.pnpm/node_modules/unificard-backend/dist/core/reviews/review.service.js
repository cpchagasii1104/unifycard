"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = void 0;
// backend/src/core/reviews/review.service.ts
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
const identity_utils_1 = require("@core/identity/identity.utils");
class ReviewService {
    toReview(row) {
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
            context: (row.context ?? undefined),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    async getById(tenantId, reviewId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT review_id, tenant_id, entity_type, entity_id, author_user_id, author_global_user_id, source_module, rating, comment, quality_rating, punctuality_rating, professionalism_rating, context, created_at, updated_at FROM reviews WHERE review_id = $1`, [reviewId]);
        return row ? this.toReview(row) : null;
    }
    async createReview(tenantId, authorUserId, sourceModule, input) {
        // Resolver global_user_id do autor
        const authorGlobalUserId = await (0, identity_utils_1.resolveGlobalUserId)(authorUserId, tenantId);
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
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
      `, [
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
        ]);
        if (!row) {
            throw new Error('Failed to create review');
        }
        const review = this.toReview(row);
        // Evento genérico de review criada (transversal)
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'core.review.created',
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
        return review;
    }
    async listReviews(tenantId, filters) {
        const { entityType, entityId, authorUserId, limit = 50, offset = 0 } = filters;
        const params = [tenantId];
        let i = 2;
        const where = ['tenant_id = $1'];
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
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT review_id, tenant_id, entity_type, entity_id, author_user_id, author_global_user_id, source_module, rating, comment, quality_rating, punctuality_rating, professionalism_rating, context, created_at, updated_at
      FROM reviews
      WHERE ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `, [...params, limit, offset]);
        const count = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT COUNT(*) AS total FROM reviews WHERE ${whereSQL}`, params);
        if (!count) {
            throw new Error('Failed to count reviews');
        }
        return {
            reviews: rows.map(r => this.toReview(r)),
            total: Number(count.total),
        };
    }
}
exports.reviewService = new ReviewService();
//# sourceMappingURL=review.service.js.map