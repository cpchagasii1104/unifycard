"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceTypesController = exports.ServiceTypesController = void 0;
const errors_1 = require("@core/errors");
const service_types_service_1 = require("./service-types.service");
class ServiceTypesController {
    async createServiceType(req, reply) {
        // pega o tenantId decorado pelo tenant plugin
        const tenantId = req.tenant?.id;
        const body = req.body;
        if (!tenantId) {
            throw new errors_1.BadRequestError('Missing tenantId');
        }
        const type = await service_types_service_1.serviceTypesService.createServiceType(tenantId, body);
        return reply.send({
            success: true,
            data: type,
        });
    }
    async listServiceTypes(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            throw new errors_1.BadRequestError('Missing tenantId');
        }
        const types = await service_types_service_1.serviceTypesService.listServiceTypes(tenantId);
        return reply.send({
            success: true,
            data: types,
        });
    }
}
exports.ServiceTypesController = ServiceTypesController;
exports.serviceTypesController = new ServiceTypesController();
