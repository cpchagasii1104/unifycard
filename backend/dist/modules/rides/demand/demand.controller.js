"use strict";
// backend/src/modules/rides/demand/demand.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.demandController = exports.DemandController = void 0;
const demand_service_1 = require("./demand.service");
/**
 * Controller de demanda do módulo Rides.
 *
 * Usa o serviço `demandService.calculateZonePressure` para calcular
 * a pressão de demanda de uma zona específica.
 */
class DemandController {
    async recalculateZonePressure(req, reply) {
        const { zoneId } = req.params;
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return reply.status(401).send({ error: 'Tenant not found' });
        }
        const pressure = await demand_service_1.demandService.calculateZonePressure(tenantId, String(zoneId));
        return reply.send({
            success: true,
            data: {
                zoneId,
                pressure,
            },
        });
    }
}
exports.DemandController = DemandController;
exports.demandController = new DemandController();
//# sourceMappingURL=demand.controller.js.map