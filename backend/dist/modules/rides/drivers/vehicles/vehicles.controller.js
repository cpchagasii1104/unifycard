"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vehiclesController = exports.VehiclesController = void 0;
const vehicles_service_1 = require("./vehicles.service");
class VehiclesController {
    async create(req, reply) {
        const body = req.body;
        const vehicle = await vehicles_service_1.vehiclesService.createVehicle(body);
        return reply.send({ success: true, data: vehicle });
    }
    async update(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new Error('Missing tenant context');
        const { vehicleId } = req.params;
        const body = req.body;
        const vehicle = await vehicles_service_1.vehiclesService.updateVehicle(tenantId, vehicleId, body);
        return reply.send({ success: true, data: vehicle });
    }
    async list(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new Error('Missing tenant context');
        const { driverId } = req.params;
        const list = await vehicles_service_1.vehiclesService.listVehicles(tenantId, driverId);
        return reply.send({ success: true, data: list });
    }
    async getOne(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new Error('Missing tenant context');
        const { vehicleId } = req.params;
        const vehicle = await vehicles_service_1.vehiclesService.getVehicleById(tenantId, vehicleId);
        return reply.send({ success: true, data: vehicle });
    }
    async verify(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new Error('Missing tenant context');
        const { vehicleId } = req.params;
        const { partnerId } = req.body;
        const vehicle = await vehicles_service_1.vehiclesService.verifyVehicle(tenantId, vehicleId, partnerId);
        return reply.send({ success: true, data: vehicle });
    }
}
exports.VehiclesController = VehiclesController;
exports.vehiclesController = new VehiclesController();
//# sourceMappingURL=vehicles.controller.js.map