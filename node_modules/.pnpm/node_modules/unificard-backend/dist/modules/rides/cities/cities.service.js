"use strict";
// src/modules/rides/cities/cities.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.citiesService = exports.CitiesService = void 0;
const db_1 = require("@core/db");
const errors_1 = require("@core/errors");
const event_bus_1 = require("@core/events/event-bus");
class CitiesService {
    eventBusInstance;
    constructor(eventBusInstance = event_bus_1.eventBus) {
        this.eventBusInstance = eventBusInstance;
    }
    // ============================================================================
    // 🔹 1. Criar uma nova cidade
    // ============================================================================
    async createCity(tenantId, data) {
        const { name, state, timezone, lat, lng, base_fare, min_price, price_per_km, price_per_min, enabled = true, allows_multi_stop = true, } = data;
        if (!name || !state) {
            throw new errors_1.BadRequestError('Nome e estado são obrigatórios.');
        }
        // Evitar cidades duplicadas
        const exists = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT 1 AS exists
        FROM rides_cities
        WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)
        LIMIT 1
        `,
            values: [tenantId, name],
        });
        if (exists) {
            throw new errors_1.BadRequestError('Uma cidade com este nome já existe.');
        }
        const city = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_cities (
          tenant_id,
          name, state, timezone,
          lat, lng,
          base_fare, min_price, price_per_km, price_per_min,
          enabled, allows_multi_stop,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
        RETURNING *
        `,
            values: [
                tenantId,
                name,
                state,
                timezone,
                lat,
                lng,
                base_fare,
                min_price,
                price_per_km,
                price_per_min,
                enabled,
                allows_multi_stop,
            ],
        });
        if (!city) {
            throw new Error('Falha ao criar cidade');
        }
        await this.eventBusInstance.emit({
            type: 'rides.city.created',
            tenantId,
            payload: {
                cityId: city.city_id,
                name: city.name,
            },
        });
        return city;
    }
    // ============================================================================
    // 🔹 2. Atualizar uma cidade
    // ============================================================================
    async updateCity(tenantId, cityId, patch) {
        await this.getCity(tenantId, cityId); // Valida que a cidade existe
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_cities
        SET
          name = COALESCE($3, name),
          state = COALESCE($4, state),
          timezone = COALESCE($5, timezone),
          lat = COALESCE($6, lat),
          lng = COALESCE($7, lng),
          base_fare = COALESCE($8, base_fare),
          min_price = COALESCE($9, min_price),
          price_per_km = COALESCE($10, price_per_km),
          price_per_min = COALESCE($11, price_per_min),
          enabled = COALESCE($12, enabled),
          allows_multi_stop = COALESCE($13, allows_multi_stop),
          updated_at = now()
        WHERE tenant_id = $1 AND city_id = $2
        RETURNING *
        `,
            values: [
                tenantId,
                cityId,
                patch.name,
                patch.state,
                patch.timezone,
                patch.lat,
                patch.lng,
                patch.base_fare,
                patch.min_price,
                patch.price_per_km,
                patch.price_per_min,
                patch.enabled,
                patch.allows_multi_stop,
            ],
        });
        if (!updated) {
            throw new Error('Falha ao atualizar cidade');
        }
        await this.eventBusInstance.emit({
            type: 'rides.city.updated',
            tenantId,
            payload: {
                cityId,
            },
        });
        return updated;
    }
    // ============================================================================
    // 🔹 3. Listar cidades
    // ============================================================================
    async listCities(tenantId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_cities
        WHERE tenant_id = $1
        ORDER BY name ASC
        `,
            values: [tenantId],
        });
    }
    // ============================================================================
    // 🔹 4. Obter cidade
    // ============================================================================
    async getCity(tenantId, cityId) {
        const city = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        `,
            values: [tenantId, cityId],
        });
        if (!city) {
            throw new errors_1.NotFoundError('Cidade não encontrada.');
        }
        return city;
    }
    // ============================================================================
    // 🔹 5. Deletar cidade (apenas se não houver zonas associadas)
    // ============================================================================
    async deleteCity(tenantId, cityId) {
        const zones = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT COUNT(*) FROM rides_zones WHERE tenant_id = $1 AND city_id = $2`,
            values: [tenantId, cityId],
        });
        if (zones && +zones.count > 0) {
            throw new errors_1.BadRequestError('Não é possível excluir uma cidade com zonas cadastradas.');
        }
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        DELETE FROM rides_cities
        WHERE tenant_id = $1 AND city_id = $2
        `,
            values: [tenantId, cityId],
        });
        await this.eventBusInstance.emit({
            type: 'rides.city.deleted',
            tenantId,
            payload: { cityId },
        });
        return { ok: true };
    }
}
exports.CitiesService = CitiesService;
exports.citiesService = new CitiesService();
//# sourceMappingURL=cities.service.js.map