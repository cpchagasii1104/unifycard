"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.driversController = exports.DriversController = void 0;
const drivers_service_1 = require("./drivers.service");
class DriversController {
    async createDriver(req, reply) {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
        const driver = await drivers_service_1.driversService.createDriver(tenantId, userId);
        return reply.send({ success: true, data: driver });
    }
    async updateDriver(req, reply) {
        const tenantId = req.tenant?.id;
        const driverId = req.params.driverId;
        const body = req.body;
        const updated = await drivers_service_1.driversService.updateDriver(tenantId, driverId, body);
        return reply.send({ success: true, data: updated });
    }
    async listDrivers(req, reply) {
        const tenantId = req.tenant?.id;
        const list = await drivers_service_1.driversService.listDrivers(tenantId);
        return reply.send({ success: true, data: list });
    }
    async getMyDriverProfile(req, reply) {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        const driver = await drivers_service_1.driversService.getDriverByUserId(tenantId, userId);
        return reply.send({ success: true, data: driver });
    }
}
exports.DriversController = DriversController;
exports.driversController = new DriversController();
// drivers.controller.ts 
//# sourceMappingURL=drivers.controller.js.map