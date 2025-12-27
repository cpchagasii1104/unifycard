"use strict";
// src/modules/rides/demand/demand.routes.ts
//
// Rotas Fastify para Demand no módulo Rides
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const demandRoutes = async (fastify) => {
    // =====================================================================
    // GET /zones/:zoneId — consulta pressão atual de uma zona
    // =====================================================================
    fastify.get('/zones/:zoneId', {
        preHandler: [fastify.requirePermission(['rides:demand:read'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { zoneId } = req.params;
        const zone = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
          SELECT
            z.zone_id,
            z.name,
            z.city_id,
            z.polygon,
            dp.pressure,
            dp.level,
            dp.active_requests,
            dp.available_drivers,
            dp.calculated_at
          FROM rides_zones z
          LEFT JOIN rides_zone_demand_pressure dp
            ON dp.zone_id = z.zone_id
          WHERE z.tenant_id = $1 AND z.zone_id = $2;
        `,
            values: [tenantId, zoneId],
        });
        if (!zone) {
            throw new errors_1.NotFoundError('Zone not found');
        }
        return zone;
    });
    // =====================================================================
    // POST /zones/:zoneId/recalculate — recalcula pressão da zona
    // =====================================================================
    fastify.post('/zones/:zoneId/recalculate', {
        preHandler: [fastify.requirePermission(['rides:demand:write'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { zoneId } = req.params;
        const result = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // Recalcular pressão
            const calcRows = await trx.query({
                text: `
            SELECT *
            FROM rides_calculate_zone_pressure($1, $2);
          `,
                values: [tenantId, zoneId],
            });
            const calc = calcRows[0];
            if (!calc) {
                throw new errors_1.NotFoundError('Zone not found or no pressure result');
            }
            // Incentivo automático (depende da função SQL)
            const incentiveRows = await trx.query({
                text: `
            SELECT
              rides_create_auto_zone_incentive($1, $2, 'auto-demand') AS incentive_id;
          `,
                values: [tenantId, zoneId],
            });
            return {
                pressure: calc,
                incentiveId: incentiveRows[0]?.incentive_id ?? null,
            };
        });
        return {
            recalculated: result.pressure,
            incentive_triggered: result.incentiveId,
        };
    });
    // =====================================================================
    // GET /pressure — heatmap geral (todas as zonas)
    // =====================================================================
    fastify.get('/pressure', {
        preHandler: [fastify.requirePermission(['rides:demand:read'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const zones = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          SELECT
            z.zone_id,
            z.name,
            dp.pressure,
            dp.level,
            dp.active_requests,
            dp.available_drivers,
            dp.calculated_at
          FROM rides_zones z
          LEFT JOIN rides_zone_demand_pressure dp
            ON dp.zone_id = z.zone_id
          WHERE z.tenant_id = $1
          ORDER BY dp.level DESC NULLS LAST, z.name ASC;
        `,
            values: [tenantId],
        });
        return zones;
    });
    // =====================================================================
    // POST /zones/:zoneId/incentives — cria incentivo manualmente
    // =====================================================================
    fastify.post('/zones/:zoneId/incentives', {
        preHandler: [fastify.requirePermission(['rides:demand:write'])],
    }, async (req, reply) => {
        const tenantId = req.tenant?.id;
        if (!tenantId)
            throw new errors_1.BadRequestError('Missing tenant context');
        const { zoneId } = req.params;
        const { value, reason } = req.body;
        if (!value)
            throw new errors_1.BadRequestError('value required');
        const result = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const rows = await trx.query({
                text: `
            INSERT INTO rides_zone_incentives (
              tenant_id,
              zone_id,
              value,
              reason,
              active_from,
              active_until
            )
            VALUES ($1, $2, $3, $4, NOW(), NULL)
            RETURNING *;
          `,
                values: [tenantId, zoneId, value, reason ?? 'manual'],
            });
            return rows[0];
        });
        reply.code(201);
        return result;
    });
};
exports.default = demandRoutes;
//# sourceMappingURL=demand.routes.js.map