"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const review_service_1 = require("./review.service");
const review_schemas_1 = require("./review.schemas");
const reviewRoutes = async (fastify) => {
    /**
     * POST /reviews
     * Criar review universal
     */
    fastify.post('/', {
        preHandler: fastify.requirePermission(['reviews:create']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const body = review_schemas_1.createReviewSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const authorUserId = req.user.id;
        const sourceModule = req.query.sourceModule || 'direct';
        const review = await review_service_1.reviewService.createReview(tenantId, authorUserId, sourceModule, body);
        return reply.status(201).send(review);
    });
    /**
     * GET /reviews
     * Listar reviews com filtros
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['reviews:read']),
    }, async (req) => {
        // Validação manual com Zod
        const query = review_schemas_1.listReviewsQuerySchema.parse(req.query);
        const tenantId = req.tenant.id;
        const result = await review_service_1.reviewService.listReviews(tenantId, query);
        return result;
    });
    /**
     * GET /reviews/:reviewId
     * Buscar review por ID
     */
    fastify.get('/:reviewId', {
        preHandler: fastify.requirePermission(['reviews:read']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = review_schemas_1.reviewIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { reviewId } = params;
        const review = await review_service_1.reviewService.getById(tenantId, reviewId);
        if (!review) {
            return reply.notFound('Review not found');
        }
        return review;
    });
};
exports.default = reviewRoutes;
