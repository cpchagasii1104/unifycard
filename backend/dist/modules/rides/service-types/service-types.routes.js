"use strict";
// src/modules/rides/service-types/service-types.routes.ts
//
// Rotas Fastify para tipos de serviço no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const service_types_service_1 = require("./service-types.service");
const serviceTypesRoutes = async (fastify) => {
    // =====================================================================
    // GET /service-types — lista tipos de serviço ativos
    // =====================================================================
    fastify.get('/', {
        preHandler: [fastify.requirePermission(['rides:service-types:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const serviceTypes = await service_types_service_1.serviceTypesService.listServiceTypes(tenantId);
        return serviceTypes;
    });
    // =====================================================================
    // GET /service-types/:id — detalhes de um tipo de serviço
    // =====================================================================
    fastify.get('/:id', {
        preHandler: [fastify.requirePermission(['rides:service-types:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { id } = req.params;
        const serviceType = await service_types_service_1.serviceTypesService.getServiceType(tenantId, id);
        return serviceType;
    });
    // =====================================================================
    // POST /service-types — criar tipo de serviço (admin)
    // =====================================================================
    fastify.post('/', {
        preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { name, description, capacity, baseMultiplier, iconUrl } = req.body;
        if (!name)
            throw new errors_1.BadRequestError('name required');
        if (!capacity)
            throw new errors_1.BadRequestError('capacity required');
        const serviceType = await service_types_service_1.serviceTypesService.createServiceType(tenantId, {
            name,
            description,
            capacity,
            base_fare: null,
            min_fare: null,
            price_per_km: null,
            price_per_min: null,
            capacity_min: capacity,
            capacity_max: capacity,
            is_luxury: false,
            is_motorcycle: false,
            is_cargo: false,
            icon_url: iconUrl,
            image_url: null,
            base_multiplier: baseMultiplier ?? 1.0,
        });
        reply.code(201);
        return serviceType;
    });
    // =====================================================================
    // PATCH /service-types/:id — atualizar tipo de serviço
    // =====================================================================
    fastify.patch('/:id', {
        preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { id } = req.params;
        const patch = req.body;
        const serviceType = await service_types_service_1.serviceTypesService.updateServiceType(tenantId, id, {
            name: patch.name,
            description: patch.description,
            capacity_min: patch.capacity,
            capacity_max: patch.capacity,
            base_multiplier: patch.baseMultiplier,
            is_active: patch.isActive,
            icon_url: patch.iconUrl,
        });
        return serviceType;
    });
    // =====================================================================
    // DELETE /service-types/:id — soft delete (is_active = false)
    // =====================================================================
    fastify.delete('/:id', {
        preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { id } = req.params;
        await service_types_service_1.serviceTypesService.deleteServiceType(tenantId, id);
        return { ok: true };
    });
    // =====================================================================
    // GET /service-types/:id/drivers — lista motoristas que suportam esse tipo
    // =====================================================================
    fastify.get('/:id/drivers', {
        preHandler: [fastify.requirePermission(['rides:service-types:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { id } = req.params;
        const drivers = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          SELECT
            ds.driver_id,
            d.user_id,
            d.status,
            d.level,
            ds.created_at
          FROM rides_driver_services ds
          JOIN rides_drivers d ON d.driver_id = ds.driver_id
          WHERE ds.service_type_id = $1 AND d.tenant_id = $2
          ORDER BY d.created_at DESC;
        `,
            values: [id, tenantId],
        });
        return drivers;
    });
    // =====================================================================
    // POST /service-types/:id/drivers — permite motorista habilitar um serviço
    // =====================================================================
    fastify.post('/:id/drivers', {
        preHandler: [fastify.requirePermission(['rides:service-types:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId)
            throw new errors_1.BadRequestError('Missing tenant or user context');
        const { id: serviceTypeId } = req.params;
        const result = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // pegar driver_id
            const driverRows = await trx.query({
                text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE tenant_id = $1 AND user_id = $2
            LIMIT 1;
          `,
                values: [tenantId, userId],
            });
            if (driverRows.length === 0)
                throw new errors_1.NotFoundError('Driver profile not found');
            const driverId = driverRows[0].driver_id;
            // verificar se já existe
            const existing = await trx.query({
                text: `
            SELECT *
            FROM rides_driver_services
            WHERE driver_id = $1 AND service_type_id = $2;
          `,
                values: [driverId, serviceTypeId],
            });
            if (existing.length > 0) {
                throw new errors_1.ConflictError('Service already enabled for driver');
            }
            // verificar compliance mínima do veículo
            const vehicles = await trx.query({
                text: `
            SELECT vehicle_id
            FROM rides_vehicles
            WHERE tenant_id = $1 AND driver_id = $2 AND is_active = TRUE
            LIMIT 1;
          `,
                values: [tenantId, driverId],
            });
            if (vehicles.length === 0) {
                throw new errors_1.ConflictError('Driver has no active vehicle');
            }
            // inserir
            const rows = await trx.query({
                text: `
            INSERT INTO rides_driver_services (
              driver_id,
              service_type_id,
              created_at
            )
            VALUES ($1, $2, NOW())
            RETURNING *;
          `,
                values: [driverId, serviceTypeId],
            });
            return rows[0];
        });
        reply.code(201);
        return result;
    });
};
exports.default = serviceTypesRoutes;
//# sourceMappingURL=service-types.routes.js.map