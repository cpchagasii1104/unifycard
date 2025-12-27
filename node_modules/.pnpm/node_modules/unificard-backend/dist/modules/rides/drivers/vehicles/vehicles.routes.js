"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const vehicles_service_1 = require("./vehicles.service");
const vehiclesRoutes = async (fastify) => {
    // =====================================================================
    // POST /drivers/:driverId/vehicles — cria veículo
    // =====================================================================
    fastify.post('/drivers/:driverId/vehicles', {
        preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const vehicle = await vehicles_service_1.vehiclesService.createVehicle({
            tenantId,
            driverId,
            ...req.body,
        });
        reply.code(201);
        return vehicle;
    });
    // =====================================================================
    // GET /drivers/:driverId/vehicles — lista veículos do motorista
    // =====================================================================
    fastify.get('/drivers/:driverId/vehicles', {
        preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const vehicles = await vehicles_service_1.vehiclesService.listVehicles(tenantId, driverId);
        return vehicles;
    });
    // =====================================================================
    // GET /vehicles/:vehicleId — detalhes de um veículo
    // =====================================================================
    fastify.get('/vehicles/:vehicleId', {
        preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { vehicleId } = req.params;
        const vehicle = await vehicles_service_1.vehiclesService.getVehicleById(tenantId, vehicleId);
        return vehicle;
    });
    // =====================================================================
    // PATCH /vehicles/:vehicleId — atualiza veículo
    // =====================================================================
    fastify.patch('/vehicles/:vehicleId', {
        preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { vehicleId } = req.params;
        const vehicle = await vehicles_service_1.vehiclesService.updateVehicle(tenantId, vehicleId, req.body);
        return vehicle;
    });
    // =====================================================================
    // POST /vehicles/:vehicleId/verify — verificação em loja parceira
    // =====================================================================
    fastify.post('/vehicles/:vehicleId/verify', {
        preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { vehicleId } = req.params;
        const { partnerId } = req.body;
        const vehicle = await vehicles_service_1.vehiclesService.verifyVehicle(tenantId, vehicleId, partnerId);
        return vehicle;
    });
};
exports.default = vehiclesRoutes;
//# sourceMappingURL=vehicles.routes.js.map