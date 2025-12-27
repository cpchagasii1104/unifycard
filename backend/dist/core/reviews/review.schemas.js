"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReviewsQuerySchema = exports.reviewIdParamsSchema = exports.createReviewSchema = void 0;
// backend/src/core/reviews/review.schemas.ts
const zod_1 = require("zod");
exports.createReviewSchema = zod_1.z.object({
    entityType: zod_1.z.string().min(1),
    entityId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional(),
    qualityRating: zod_1.z.number().min(1).max(5).optional(),
    punctualityRating: zod_1.z.number().min(1).max(5).optional(),
    professionalismRating: zod_1.z.number().min(1).max(5).optional(),
    context: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.reviewIdParamsSchema = zod_1.z.object({
    reviewId: zod_1.z.string().uuid(),
});
exports.listReviewsQuerySchema = zod_1.z.object({
    entityType: zod_1.z.string().optional(),
    entityId: zod_1.z.string().uuid().optional(),
    authorUserId: zod_1.z.string().uuid().optional(),
    limit: zod_1.z.string().transform(v => (v ? parseInt(v, 10) : 50)).optional(),
    offset: zod_1.z.string().transform(v => (v ? parseInt(v, 10) : 0)).optional(),
});
//# sourceMappingURL=review.schemas.js.map