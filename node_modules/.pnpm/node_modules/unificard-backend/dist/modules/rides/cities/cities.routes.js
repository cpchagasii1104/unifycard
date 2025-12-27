"use strict";
// src/modules/rides/cities/cities.routes.ts
//
// Rotas Fastify para o módulo de Cidades (Rides)
// Prefixo real: /rides/cities (definido em rides.module.ts)
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const cities_service_1 = require("./cities.service");
// ------------------------------------------------------------
// Plugin de rotas
// ------------------------------------------------------------
const citiesRoutes = async (fastify) => {
    // =====================================================================
    // GET /cities — lista todas as cidades operadas
    // =====================================================================
    fastify.get('/', async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const rows = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          SELECT city_id AS id, name, state, country, is_active
          FROM rides_cities
          ORDER BY name ASC;
        `,
        });
        return rows.map((row) => ({
            id: row.city_id,
            name: row.name,
            state: row.state,
            country: row.country,
            is_active: row.is_active,
        }));
    });
    // =====================================================================
    // GET /cities/:cityId — detalhes de uma cidade
    // =====================================================================
    fastify.get('/:cityId', async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { cityId } = req.params;
        const city = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          SELECT city_id AS id, name, state, country, is_active
          FROM rides_cities
          WHERE city_id = $1;
        `,
            values: [cityId],
        });
        if (!city) {
            throw new errors_1.NotFoundError('City not found');
        }
        return {
            id: city.city_id,
            name: city.name,
            state: city.state,
            country: city.country,
            is_active: city.is_active,
        };
    });
    // =====================================================================
    // POST /cities — cria cidade (com permissão)
    // =====================================================================
    fastify.post('/', {
        preHandler: [
            fastify.requirePermission(['rides:cities:write']), // 🔥 RBAC Fastify
        ],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const city = await cities_service_1.citiesService.createCity(tenantId, req.body);
        reply.code(201);
        return city;
    });
};
exports.default = citiesRoutes;
//# sourceMappingURL=cities.routes.js.map