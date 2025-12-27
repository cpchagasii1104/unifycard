"use strict";
// backend/src/modules/rides/distribution/distribution.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributionController = exports.DistributionController = void 0;
const distribution_service_1 = require("./distribution.service");
/**
 * Controller de distribuição financeira do módulo Rides.
 *
 * Este controller é um ponto de entrada HTTP para visualizar/aplicar
 * distribuição de valores de uma corrida.
 */
class DistributionController {
    async getRideDistribution(req, reply) {
        const { rideId } = req.params;
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return reply.status(401).send({ error: 'Tenant not found' });
        }
        const distribution = await distribution_service_1.distributionService.getByRideId(tenantId, String(rideId));
        return reply.send({
            success: true,
            data: distribution,
        });
    }
    async applyDistribution(req, reply) {
        const { rideId } = req.params;
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return reply.status(401).send({ error: 'Tenant not found' });
        }
        const body = req.body;
        const distribution = await distribution_service_1.distributionService.applyDistributionToRide(tenantId, String(rideId), body);
        return reply.send({
            success: true,
            data: distribution,
        });
    }
}
exports.DistributionController = DistributionController;
exports.distributionController = new DistributionController();
//# sourceMappingURL=distribution.controller.js.map