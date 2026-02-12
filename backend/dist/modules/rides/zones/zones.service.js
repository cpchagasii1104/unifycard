"use strict";
// src/modules/rides/zones/zones.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.zonesService = exports.ZonesService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
class ZonesService {
    // ============================================================================================
    // 🔹 1. Criar zona geográfica
    // ============================================================================================
    async createZone(tenantId, cityId, data) {
        const { name, polygon } = data;
        if (!name)
            throw new errors_1.BadRequestError('Nome da zona é obrigatório.');
        if (!polygon)
            throw new errors_1.BadRequestError('Polígono GeoJSON é obrigatório.');
        // Validar polígono
        const isValid = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS valid`,
            values: [JSON.stringify(polygon)],
        });
        if (!isValid?.valid) {
            throw new errors_1.BadRequestError('Polígono inválido. Verifique o GeoJSON.');
        }
        const zone = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_zones (
        tenant_id, city_id,
        name, polygon, area_m2,
        createdAt
      )
      VALUES (
        $1, $2,
        $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
        ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography),
        now()
      )
      RETURNING zone_id, name, city_id
      `,
            values: [tenantId, cityId, name, JSON.stringify(polygon)],
        });
        if (!zone) {
            throw new Error('Failed to create zone');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.zone.created',
            tenantId,
            payload: {
                cityId,
                zoneId: zone.zone_id,
            },
        });
        return zone;
    }
    // ============================================================================================
    // 🔹 2. Atualizar zona
    // ============================================================================================
    async updateZone(tenantId, zoneId, patch) {
        const existing = await this.getZone(tenantId, zoneId);
        let newPolygon = null;
        let newArea = null;
        if (patch.polygon) {
            const isValid = await (0, db_1.runQueryWithTenant)(tenantId, {
                text: `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS valid`,
                values: [JSON.stringify(patch.polygon)],
            });
            if (!isValid?.valid) {
                throw new errors_1.BadRequestError('Polígono inválido.');
            }
            newPolygon = patch.polygon;
            const areaRow = await (0, db_1.runQueryWithTenant)(tenantId, {
                text: `
        SELECT ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) AS area
        `,
                values: [JSON.stringify(patch.polygon)],
            });
            newArea = areaRow;
        }
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_zones
      SET 
        name = COALESCE($3, name),
        polygon = COALESCE(
          ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
          polygon
        ),
        area_m2 = COALESCE($5, area_m2),
        updatedAt = now()
      WHERE tenant_id = $1 AND zone_id = $2
      RETURNING *
      `,
            values: [
                tenantId,
                zoneId,
                patch.name,
                newPolygon ? JSON.stringify(newPolygon) : null,
                newArea ? newArea.area : null,
            ],
        });
        if (!updated) {
            throw new Error('Failed to update zone');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.zone.updated',
            tenantId,
            payload: {
                zoneId,
            },
        });
        return updated;
    }
    // ============================================================================================
    // 🔹 3. Buscar zona por coordenadas (USADO PELO LOCATION SERVICE)
    // ============================================================================================
    async findZoneByPoint(tenantId, lat, lng) {
        return (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT zone_id, name, city_id
      FROM rides_zones
      WHERE tenant_id = $1
        AND ST_Contains(
          polygon,
          ST_SetSRID(ST_MakePoint($3, $2), 4326)
        )
      LIMIT 1;
      `,
            values: [tenantId, lat, lng],
        });
    }
    // ============================================================================================
    // 🔹 4. Listar zonas de uma cidade
    // ============================================================================================
    async listZonesByCity(tenantId, cityId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT zone_id, name, area_m2, createdAt
      FROM rides_zones
      WHERE tenant_id = $1 AND city_id = $2
      ORDER BY name ASC
      `,
            values: [tenantId, cityId],
        });
    }
    // ============================================================================================
    // 🔹 5. Obter zona
    // ============================================================================================
    async getZone(tenantId, zoneId) {
        const zone = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_zones
      WHERE tenant_id = $1 AND zone_id = $2
      `,
            values: [tenantId, zoneId],
        });
        if (!zone)
            throw new errors_1.NotFoundError('Zona não encontrada.');
        return zone;
    }
    // ============================================================================================
    // 🔹 6. Deletar zona
    // ============================================================================================
    async deleteZone(tenantId, zoneId) {
        const deleted = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      DELETE FROM rides_zones
      WHERE tenant_id = $1 AND zone_id = $2
      RETURNING zone_id
      `,
            values: [tenantId, zoneId],
        });
        if (!deleted) {
            throw new errors_1.NotFoundError('Zona não encontrada.');
        }
        await event_bus_1.eventBus.emit({
            type: 'rides.zone.deleted',
            tenantId,
            payload: {
                zoneId,
            },
        });
        return { ok: true };
    }
    // ============================================================================================
    // 🔹 7. Atualizar pressão de demanda ao alterar zona
    // ============================================================================================
    async recalcDemandForZone(tenantId, zoneId) {
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT rides_calculate_zone_pressure($1, $2)`,
            values: [tenantId, zoneId],
        });
        await event_bus_1.eventBus.emit({
            type: 'rides.zone.demand_recalculated',
            tenantId,
            payload: {
                zoneId,
            },
        });
        return { ok: true };
    }
}
exports.ZonesService = ZonesService;
exports.zonesService = new ZonesService();
