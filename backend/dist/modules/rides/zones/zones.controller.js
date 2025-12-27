"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zonesController = exports.ZonesController = void 0;
const zones_service_1 = require("./zones.service");
class ZonesController {
    async createZone(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new Error('Missing tenant context');
        const body = req.body;
        const { cityId } = body;
        const zone = await zones_service_1.zonesService.createZone(tenantId, cityId, body);
        return reply.send({
            success: true,
            data: zone
        });
    }
    async listZones(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new Error('Missing tenant context');
        const cityId = req.query.cityId;
        const zones = await zones_service_1.zonesService.listZonesByCity(tenantId, cityId);
        return reply.send({
            success: true,
            data: zones
        });
    }
}
exports.ZonesController = ZonesController;
exports.zonesController = new ZonesController();
// zones.controller.ts 
//# sourceMappingURL=zones.controller.js.map