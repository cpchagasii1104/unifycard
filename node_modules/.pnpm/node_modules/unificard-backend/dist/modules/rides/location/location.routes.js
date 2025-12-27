"use strict";
// src/modules/rides/location/location.routes.ts
//
// Rotas Fastify para localização no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const location_service_1 = require("./location.service");
const locationRoutes = async (fastify) => {
    // =====================================================================
    // POST /drivers/location — receber ping de localização
    // =====================================================================
    fastify.post('/drivers/location', {
        preHandler: [fastify.requirePermission(['rides:location:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId, lat, lng } = req.body;
        const result = await location_service_1.locationService.updateLocation({
            tenantId,
            driverId,
            lat,
            lng,
        });
        return result;
    });
    // =====================================================================
    // GET /location/distance — calcular distância/ETA
    // =====================================================================
    fastify.get('/location/distance', {
        preHandler: [fastify.requirePermission(['rides:location:read'])],
    }, async (req, reply) => {
        const { lat1, lng1, lat2, lng2 } = req.query;
        const distance = await location_service_1.locationService.calculateDistanceMeters(Number(lat1), Number(lng1), Number(lat2), Number(lng2));
        const eta = await location_service_1.locationService.calculateETASeconds(distance);
        return {
            distance_meters: distance,
            eta_seconds: eta,
        };
    });
};
exports.default = locationRoutes;
//# sourceMappingURL=location.routes.js.map