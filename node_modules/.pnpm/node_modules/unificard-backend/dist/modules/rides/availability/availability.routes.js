"use strict";
// ------------------------------------------------------------
// src/modules/rides/availability/availability.routes.ts
// Disponibilidade do motorista — Fastify Unificard v1
// ------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("@core/errors");
const db_1 = require("@core/db");
// ------------------------------------------------------------
// Plugin Fastify
// ------------------------------------------------------------
const availabilityRoutes = async (fastify) => {
    // ============================================================
    // POST /availability/online
    // ============================================================
    fastify.post('/online', {
        preHandler: [fastify.requirePermission(['rides:availability:write'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            throw fastify.httpErrors.unauthorized('Authentication required');
        }
        const { lat, lng, cityId, vehicleId } = req.body;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !cityId) {
            throw new errors_1.BadRequestError('lat, lng and cityId are required');
        }
        const result = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // Buscar driver_id
            const [driver] = (await trx.query({
                text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE user_id = $1
            LIMIT 1;
          `,
                values: [userId],
            }));
            if (!driver)
                throw new errors_1.NotFoundError('Driver profile not found');
            const driverId = driver.driver_id;
            // Verificar limite de condução
            const [limit] = (await trx.query({
                text: `
            SELECT *
            FROM rides_check_driving_limit($1, $2);
          `,
                values: [tenantId, driverId],
            }));
            if (!limit?.can_drive) {
                throw new errors_1.ConflictError(limit?.warning ?? 'Driving limit reached');
            }
            // Criar nova sessão
            const [session] = (await trx.query({
                text: `
            INSERT INTO rides_driver_sessions (
              driver_id, vehicle_id, city_id,
              started_at, driving_minutes, forced_break_until
            )
            VALUES ($1, $2, $3, NOW(), $4, $5)
            RETURNING *;
          `,
                values: [
                    driverId,
                    vehicleId ?? null,
                    cityId,
                    limit.driving_minutes ?? 0,
                    limit.forced_break_until ?? null,
                ],
            }));
            // Availability = TRUE
            const [availability] = (await trx.query({
                text: `
            INSERT INTO rides_driver_availability (
              driver_id, is_available, updated_at
            )
            VALUES ($1, TRUE, NOW())
            ON CONFLICT (driver_id)
            DO UPDATE SET
              is_available = TRUE,
              updated_at = NOW()
            RETURNING *;
          `,
                values: [driverId],
            }));
            // Localização inicial
            await trx.query({
                text: `
            INSERT INTO rides_driver_locations (
              driver_id, location, updated_at
            )
            VALUES ($1, ST_Point($2, $3), NOW())
            ON CONFLICT (driver_id)
            DO UPDATE SET
              location = ST_Point($2, $3),
              updated_at = NOW();
          `,
                values: [driverId, lng, lat],
            });
            return {
                driver_id: driverId,
                session,
                availability,
                driving_limit: limit,
            };
        });
        return result;
    });
    // ============================================================
    // POST /availability/offline
    // ============================================================
    fastify.post('/offline', {
        preHandler: [fastify.requirePermission(['rides:availability:write'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            throw fastify.httpErrors.unauthorized('Authentication required');
        }
        const result = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const [driver] = (await trx.query({
                text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE user_id = $1
            LIMIT 1;
          `,
                values: [userId],
            }));
            if (!driver)
                throw new errors_1.NotFoundError('Driver profile not found');
            const driverId = driver.driver_id;
            // Finalizar sessão ativa
            await trx.query({
                text: `
            UPDATE rides_driver_sessions
            SET ended_at = NOW()
            WHERE driver_id = $1
              AND ended_at IS NULL;
          `,
                values: [driverId],
            });
            // Availability = FALSE
            const [availability] = (await trx.query({
                text: `
            UPDATE rides_driver_availability
            SET is_available = FALSE, updated_at = NOW()
            WHERE driver_id = $1
            RETURNING *;
          `,
                values: [driverId],
            }));
            return { driver_id: driverId, availability };
        });
        return result;
    });
    // ============================================================
    // PATCH /availability/location — heartbeat
    // ============================================================
    fastify.patch('/location', {
        preHandler: [fastify.requirePermission(['rides:availability:write'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            throw fastify.httpErrors.unauthorized('Authentication required');
        }
        const { lat, lng } = req.body;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new errors_1.BadRequestError('lat and lng required');
        }
        const out = await (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const [driver] = (await trx.query({
                text: `
            SELECT driver_id
            FROM rides_drivers
            WHERE user_id = $1
            LIMIT 1;
          `,
                values: [userId],
            }));
            if (!driver)
                throw new errors_1.NotFoundError('Driver profile not found');
            const driverId = driver.driver_id;
            // Atualizar localização
            await trx.query({
                text: `
            INSERT INTO rides_driver_locations (
              driver_id, location, updated_at
            )
            VALUES ($1, ST_Point($2, $3), NOW())
            ON CONFLICT (driver_id)
            DO UPDATE SET
              location = ST_Point($2, $3),
              updated_at = NOW();
          `,
                values: [driverId, lng, lat],
            });
            // Earnings + driving stats
            const [earnings] = (await trx.query({
                text: `
            SELECT *
            FROM rides_calculate_realtime_earnings($1, $2);
          `,
                values: [tenantId, driverId],
            }));
            return {
                driver_id: driverId,
                updated_location: { lat, lng },
                earnings,
            };
        });
        return out;
    });
    // ============================================================
    // GET /availability/status
    // ============================================================
    fastify.get('/status', {
        preHandler: [fastify.requirePermission(['rides:availability:read'])],
    }, async (req, _reply) => {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            throw fastify.httpErrors.unauthorized('Authentication required');
        }
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        WITH d AS (
          SELECT driver_id
          FROM rides_drivers
          WHERE user_id = $1
          LIMIT 1
        ),
        avail AS (
          SELECT *
          FROM rides_driver_availability
          WHERE driver_id = (SELECT driver_id FROM d)
        ),
        session AS (
          SELECT *
          FROM rides_driver_sessions
          WHERE driver_id = (SELECT driver_id FROM d)
          ORDER BY started_at DESC
          LIMIT 1
        ),
        earnings AS (
          SELECT *
          FROM rides_calculate_realtime_earnings($2, (SELECT driver_id FROM d))
        )
        SELECT
          (SELECT * FROM avail) AS availability,
          (SELECT * FROM session) AS active_session,
          (SELECT * FROM earnings) AS earnings;
      `,
            values: [userId, tenantId],
        });
        return row;
    });
};
exports.default = availabilityRoutes;
//# sourceMappingURL=availability.routes.js.map