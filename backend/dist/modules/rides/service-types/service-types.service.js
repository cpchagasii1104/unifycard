"use strict";
// src/modules/rides/service-types/service-types.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceTypesService = exports.ServiceTypesService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
class ServiceTypesService {
    // ============================================================================
    // 🔹 1. Criar tipo de serviço (UberX / Comfort / Black / Moto etc.)
    // ============================================================================
    async createServiceType(tenantId, data) {
        const { name, description, base_fare, min_fare, price_per_km, price_per_min, capacity_min, capacity_max, is_luxury = false, is_motorcycle = false, is_cargo = false, icon_url, image_url, } = data;
        if (!name)
            throw new errors_1.BadRequestError("Nome é obrigatório.");
        // Evitar duplicidade
        const found = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `SELECT 1 as count FROM rides_service_types WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)`,
            values: [tenantId, name],
        });
        if (found) {
            throw new errors_1.BadRequestError("Já existe um serviço com esse nome.");
        }
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      INSERT INTO rides_service_types (
        tenant_id, name, description,
        base_fare, min_fare, price_per_km, price_per_min,
        capacity_min, capacity_max,
        is_luxury, is_motorcycle, is_cargo,
        icon_url, image_url,
        createdAt
      )
      VALUES (
        $1,$2,$3,
        $4,$5,$6,$7,
        $8,$9,
        $10,$11,$12,
        $13,$14,
        now()
      )
      RETURNING *
      `,
            values: [
                tenantId,
                name,
                description,
                base_fare,
                min_fare,
                price_per_km,
                price_per_min,
                capacity_min,
                capacity_max,
                is_luxury,
                is_motorcycle,
                is_cargo,
                icon_url,
                image_url,
            ],
        });
        if (!row) {
            throw new Error('Failed to create service type');
        }
        await event_bus_1.eventBus.emit({
            type: "rides.service_type.created",
            tenantId,
            payload: {
                serviceTypeId: row.service_type_id,
            },
        });
        return row;
    }
    // ============================================================================
    // 🔹 2. Atualizar tipo de serviço
    // ============================================================================
    async updateServiceType(tenantId, serviceTypeId, patch) {
        const existing = await this.getServiceType(tenantId, serviceTypeId);
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      UPDATE rides_service_types
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        base_fare = COALESCE($5, base_fare),
        min_fare = COALESCE($6, min_fare),
        price_per_km = COALESCE($7, price_per_km),
        price_per_min = COALESCE($8, price_per_min),
        capacity_min = COALESCE($9, capacity_min),
        capacity_max = COALESCE($10, capacity_max),
        is_luxury = COALESCE($11, is_luxury),
        is_motorcycle = COALESCE($12, is_motorcycle),
        is_cargo = COALESCE($13, is_cargo),
        icon_url = COALESCE($14, icon_url),
        image_url = COALESCE($15, image_url),
        updatedAt = now()
      WHERE tenant_id = $1 AND service_type_id = $2
      RETURNING *
      `,
            values: [
                tenantId,
                serviceTypeId,
                patch.name,
                patch.description,
                patch.base_fare,
                patch.min_fare,
                patch.price_per_km,
                patch.price_per_min,
                patch.capacity_min,
                patch.capacity_max,
                patch.is_luxury,
                patch.is_motorcycle,
                patch.is_cargo,
                patch.icon_url,
                patch.image_url,
            ],
        });
        if (!row) {
            throw new Error('Failed to update service type');
        }
        await event_bus_1.eventBus.emit({
            type: "rides.service_type.updated",
            tenantId,
            payload: {
                serviceTypeId,
            },
        });
        return row;
    }
    // ============================================================================
    // 🔹 3. Listar tipos de serviço
    // ============================================================================
    async listServiceTypes(tenantId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_service_types
      WHERE tenant_id = $1
      ORDER BY name ASC
      `,
            values: [tenantId],
        });
    }
    // ============================================================================
    // 🔹 4. Obter tipo
    // ============================================================================
    async getServiceType(tenantId, serviceTypeId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT *
      FROM rides_service_types
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
            values: [tenantId, serviceTypeId],
        });
        if (!row)
            throw new errors_1.NotFoundError("Tipo de serviço não encontrado.");
        return row;
    }
    // ============================================================================
    // 🔹 5. Deletar tipo (se não houver veículos associados)
    // ============================================================================
    async deleteServiceType(tenantId, serviceTypeId) {
        const cnt = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT COUNT(*) as count
      FROM rides_vehicles
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
            values: [tenantId, serviceTypeId],
        });
        if (cnt && +cnt.count > 0) {
            throw new errors_1.BadRequestError("Não é possível excluir serviço com veículos associados.");
        }
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      DELETE FROM rides_service_types
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
            values: [tenantId, serviceTypeId],
        });
        await event_bus_1.eventBus.emit({
            type: "rides.service_type.deleted",
            tenantId,
            payload: {
                serviceTypeId,
            },
        });
        return { ok: true };
    }
}
exports.ServiceTypesService = ServiceTypesService;
exports.serviceTypesService = new ServiceTypesService();
