"use strict";
// src/modules/rides/zones/zones.routes.ts
//
// Rotas Fastify para zonas no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const zones_service_1 = require("./zones.service");
const zonesRoutes = async (fastify) => {
    // =====================================================================
    // POST /zones — cria zona geográfica
    // =====================================================================
    fastify.post('/', {
        preHandler: [fastify.requirePermission(['rides:zones:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { cityId, name, polygon } = req.body;
        const zone = await zones_service_1.zonesService.createZone(tenantId, cityId, { name, polygon });
        reply.code(201);
        return zone;
    });
    // =====================================================================
    // GET /zones — lista zonas (filtrado por cityId se fornecido)
    // =====================================================================
    fastify.get('/', {
        preHandler: [fastify.requirePermission(['rides:zones:read'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const cityId = req.query.cityId;
        if (cityId) {
            const zones = await zones_service_1.zonesService.listZonesByCity(tenantId, cityId);
            return zones;
        }
        // Se não houver cityId, retornar todas as zonas do tenant
        const zones = await zones_service_1.zonesService.listZonesByCity(tenantId, '');
        return zones;
    });
};
exports.default = zonesRoutes;
