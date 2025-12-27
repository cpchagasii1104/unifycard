"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reputation_service_1 = require("./reputation.service");
const zod_1 = require("zod");
const entityParamsSchema = zod_1.z.object({
    entityType: zod_1.z.string().min(1).max(50),
    entityId: zod_1.z.string().uuid(),
});
const reputationRoutes = async (fastify) => {
    /**
     * GET /reputation/:entityType/:entityId
     * Buscar score de reputação universal
     */
    fastify.get('/:entityType/:entityId', {
        preHandler: fastify.requirePermission(['reputation:read']),
    }, async (req) => {
        // Validação manual com Zod
        const params = entityParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { entityType, entityId } = params;
        const score = await reputation_service_1.reputationService.getScore(tenantId, entityType, entityId);
        return {
            entityType,
            entityId,
            score,
        };
    });
};
exports.default = reputationRoutes;
//# sourceMappingURL=reputation.routes.js.map