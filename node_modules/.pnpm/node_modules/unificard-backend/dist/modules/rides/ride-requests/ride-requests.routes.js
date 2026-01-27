"use strict";
// src/modules/rides/ride-requests/ride-requests.routes.ts
//
// Rotas Fastify para solicitações de corrida no módulo Rides
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const ride_requests_service_1 = require("./ride-requests.service");
const rideRequestsRoutes = async (fastify) => {
    // =====================================================================
    // POST /requests — criar solicitação de corrida
    // =====================================================================
    fastify.post('/requests', {
        preHandler: [fastify.requirePermission(['rides:ride-requests:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            throw new errors_1.BadRequestError('Missing tenant or user context');
        const result = await ride_requests_service_1.rideRequestsService.createRequest(tenantId, userId, req.body);
        reply.code(201);
        return result;
    });
    // =====================================================================
    // POST /requests/:requestId/accept — motorista aceita corrida
    // =====================================================================
    fastify.post('/requests/:requestId/accept', {
        preHandler: [fastify.requirePermission(['rides:ride-requests:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            throw new errors_1.BadRequestError('Missing tenant or user context');
        const { requestId } = req.params;
        // Buscar driver_id do usuário
        const { driversService } = await Promise.resolve().then(() => __importStar(require('../drivers/drivers.service')));
        const driver = await driversService.getDriverByUserId(tenantId, userId);
        if (!driver) {
            throw new errors_1.BadRequestError('Driver profile not found');
        }
        const updated = await ride_requests_service_1.rideRequestsService.driverAccept(tenantId, driver.driver_id, requestId);
        return updated;
    });
    // =====================================================================
    // POST /requests/:requestId/cancel — cancelar solicitação
    // =====================================================================
    fastify.post('/requests/:requestId/cancel', {
        preHandler: [fastify.requirePermission(['rides:ride-requests:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            throw new errors_1.BadRequestError('Missing tenant or user context');
        const { requestId } = req.params;
        const result = await ride_requests_service_1.rideRequestsService.cancelRequest(tenantId, requestId, userId);
        return result;
    });
};
exports.default = rideRequestsRoutes;
