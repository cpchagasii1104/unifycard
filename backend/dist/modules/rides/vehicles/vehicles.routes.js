"use strict";
// src/modules/rides/vehicles/vehicles.routes.ts
//
// Rotas Fastify para gestão de veículos no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const vehicles_service_1 = require("./vehicles.service");
const vehiclesRoutes = async (fastify) => {
    // =====================================================================
    // GET /vehicles — lista veículos do tenant
    // =====================================================================
    fastify.get('/', {
        preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const vehicles = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          SELECT
            vehicle_id,
            driver_id,
            plate,
            model,
            color,
            year,
            category,
            is_active,
            created_at
          FROM rides_vehicles
          WHERE tenant_id = $1
          ORDER BY created_at DESC;
        `,
            values: [tenantId],
        });
        return vehicles;
    });
    // =====================================================================
    // GET /vehicles/:vehicleId — detalhes de um veículo
    // =====================================================================
    fastify.get('/:vehicleId', {
        preHandler: [fastify.requirePermission(['rides:vehicles:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { vehicleId } = req.params;
        const vehicle = await vehicles_service_1.vehiclesService.getVehicle(tenantId, vehicleId);
        return vehicle;
    });
    // =====================================================================
    // POST /vehicles — registra um novo veículo
    // =====================================================================
    fastify.post('/', {
        preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        if (!userId)
            throw new errors_1.BadRequestError('Missing authenticated user');
        const { plate, model, color, year, category } = req.body;
        if (!plate)
            throw new errors_1.BadRequestError('Plate is required');
        if (!model)
            throw new errors_1.BadRequestError('Model is required');
        const vehicle = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // Verifica se o usuário possui DRIVER_PROFILE
            const driverRows = await trx.query({
                text: `
            SELECT driver_id FROM rides_drivers
            WHERE tenant_id = $1 AND user_id = $2
            LIMIT 1;
          `,
                values: [tenantId, userId],
            });
            if (driverRows.length === 0) {
                throw new errors_1.ConflictError('User has no driver profile');
            }
            const driverId = driverRows[0].driver_id;
            // Placa deve ser única por tenant
            const exists = await trx.query({
                text: `
            SELECT vehicle_id FROM rides_vehicles
            WHERE tenant_id = $1 AND plate = $2
            LIMIT 1;
          `,
                values: [tenantId, plate],
            });
            if (exists.length > 0) {
                throw new errors_1.ConflictError('Vehicle with this plate already exists');
            }
            const rows = await trx.query({
                text: `
            INSERT INTO rides_vehicles
              (tenant_id, driver_id, plate, model, color, year, category, is_active, created_at)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, true, now())
            RETURNING *;
          `,
                values: [
                    tenantId,
                    driverId,
                    plate,
                    model,
                    color ?? null,
                    year ?? null,
                    category ?? 'standard',
                ],
            });
            return rows[0];
        });
        reply.code(201);
        return vehicle;
    });
    // =====================================================================
    // PATCH /vehicles/:vehicleId/active — ativa/desativa um veículo
    // =====================================================================
    fastify.patch('/:vehicleId/active', {
        preHandler: [fastify.requirePermission(['rides:vehicles:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { vehicleId } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            throw new errors_1.BadRequestError('isActive must be boolean');
        }
        const vehicle = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          UPDATE rides_vehicles
          SET is_active = $3, updated_at = NOW()
          WHERE tenant_id = $1 AND vehicle_id = $2
          RETURNING *;
        `,
            values: [tenantId, vehicleId, isActive],
        });
        if (!vehicle) {
            throw new errors_1.NotFoundError('Vehicle not found');
        }
        return vehicle;
    });
};
exports.default = vehiclesRoutes;
//# sourceMappingURL=vehicles.routes.js.map