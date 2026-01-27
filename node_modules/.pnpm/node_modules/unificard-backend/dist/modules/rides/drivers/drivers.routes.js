"use strict";
// src/modules/rides/drivers/drivers.routes.ts
//
// Rotas Fastify para o módulo de Motoristas (Rides)
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const drivers_service_1 = require("./drivers.service");
const driversRoutes = async (fastify) => {
    // =====================================================================
    // GET /drivers — lista motoristas do tenant
    // =====================================================================
    fastify.get('/', {
        preHandler: [fastify.requirePermission(['rides:drivers:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const drivers = await drivers_service_1.driversService.listDrivers(tenantId);
        return drivers;
    });
    // =====================================================================
    // GET /drivers/:driverId — detalhes de um motorista
    // =====================================================================
    fastify.get('/:driverId', {
        preHandler: [fastify.requirePermission(['rides:drivers:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const driver = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          SELECT
            driver_id,
            user_id,
            status,
            level,
            active_vehicle_id,
            created_at,
            updated_at
          FROM rides_drivers
          WHERE tenant_id = $1 AND driver_id = $2;
        `,
            values: [tenantId, driverId],
        });
        if (!driver) {
            throw new errors_1.NotFoundError('Driver not found');
        }
        return driver;
    });
    // =====================================================================
    // POST /drivers — cria perfil de motorista
    // =====================================================================
    fastify.post('/', {
        preHandler: [fastify.requirePermission(['rides:drivers:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        if (!userId)
            throw new errors_1.BadRequestError('Missing authenticated user');
        const driver = await drivers_service_1.driversService.createDriver(tenantId, userId);
        reply.code(201);
        return driver;
    });
    // =====================================================================
    // PATCH /drivers/:driverId/availability — muda status de disponibilidade
    // =====================================================================
    fastify.patch('/:driverId/availability', {
        preHandler: [fastify.requirePermission(['rides:drivers:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { driverId } = req.params;
        const { isAvailable } = req.body;
        if (typeof isAvailable !== 'boolean') {
            throw new errors_1.BadRequestError('isAvailable must be boolean');
        }
        const availability = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          UPDATE rides_driver_availability
          SET is_available = $3, updated_at = NOW()
          WHERE tenant_id = $1 AND driver_id = $2
          RETURNING driver_id, is_available, updated_at;
        `,
            values: [tenantId, driverId, isAvailable],
        });
        if (!availability) {
            throw new errors_1.NotFoundError('Driver availability not found');
        }
        return availability;
    });
};
exports.default = driversRoutes;
