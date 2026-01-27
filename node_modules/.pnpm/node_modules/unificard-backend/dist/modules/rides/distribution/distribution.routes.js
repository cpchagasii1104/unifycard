"use strict";
// src/modules/rides/distribution/distribution.routes.ts
//
// Rotas Fastify para distribuição financeira no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const distribution_service_1 = require("./distribution.service");
const distributionRoutes = async (fastify) => {
    // =====================================================================
    // GET /rides/:rideId — distribuição de uma corrida específica
    // =====================================================================
    fastify.get('/rides/:rideId', {
        preHandler: [fastify.requirePermission(['rides:distribution:read'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { rideId } = req.params;
        const distribution = await distribution_service_1.distributionService.getByRideId(tenantId, rideId);
        return distribution;
    });
    // =====================================================================
    // POST /rides/:rideId/apply — aplica/reaplica distribuição em uma corrida
    // =====================================================================
    fastify.post('/rides/:rideId/apply', {
        preHandler: [fastify.requirePermission(['rides:distribution:write'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { rideId } = req.params;
        const distribution = await distribution_service_1.distributionService.applyDistributionToRide(tenantId, rideId, req.body);
        return distribution;
    });
};
exports.default = distributionRoutes;
