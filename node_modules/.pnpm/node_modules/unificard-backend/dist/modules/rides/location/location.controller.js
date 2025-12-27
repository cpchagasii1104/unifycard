"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locationController = exports.LocationController = void 0;
const location_service_1 = require("./location.service");
class LocationController {
    async update(req, reply) {
        const body = req.body;
        const result = await location_service_1.locationService.updateLocation(body);
        return reply.send({ success: true, data: result });
    }
    async distance(req, reply) {
        const { lat1, lng1, lat2, lng2 } = req.query;
        const distance = await location_service_1.locationService.calculateDistanceMeters(Number(lat1), Number(lng1), Number(lat2), Number(lng2));
        const eta = await location_service_1.locationService.calculateETASeconds(distance);
        return reply.send({
            success: true,
            distance_meters: distance,
            eta_seconds: eta,
        });
    }
}
exports.LocationController = LocationController;
exports.locationController = new LocationController();
//# sourceMappingURL=location.controller.js.map