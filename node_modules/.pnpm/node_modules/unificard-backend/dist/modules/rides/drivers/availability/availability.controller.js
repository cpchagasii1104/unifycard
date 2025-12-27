"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityController = exports.AvailabilityController = void 0;
const availability_service_1 = require("./availability.service");
class AvailabilityController {
    async setOnline(req, reply) {
        const body = req.body;
        const data = await availability_service_1.availabilityService.setOnline(body);
        return reply.send({ success: true, data });
    }
    async setOffline(req, reply) {
        const { driverId } = req.params;
        const data = await availability_service_1.availabilityService.setOffline(driverId);
        return reply.send({ success: true, data });
    }
    async setDestinationMode(req, reply) {
        const body = req.body;
        const data = await availability_service_1.availabilityService.setDestinationMode(body);
        return reply.send({ success: true, data });
    }
    async disableDestinationMode(req, reply) {
        const { driverId, tenantId } = req.params;
        const data = await availability_service_1.availabilityService.disableDestinationMode(driverId, tenantId);
        return reply.send({ success: true, data });
    }
    async getAvailability(req, reply) {
        const { driverId } = req.params;
        const data = await availability_service_1.availabilityService.getAvailability(driverId);
        return reply.send({ success: true, data });
    }
}
exports.AvailabilityController = AvailabilityController;
exports.availabilityController = new AvailabilityController();
//# sourceMappingURL=availability.controller.js.map