// src/modules/rides/service-types/service-types.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from "@core/db";
import { eventBus } from "@core/events/event-bus";
import { BadRequestError, NotFoundError } from "@core/errors";

export class ServiceTypesService {

  // ============================================================================
  // 🔹 1. Criar tipo de serviço (UberX / Comfort / Black / Moto etc.)
  // ============================================================================
  async createServiceType(tenantId: string, data: any) {
    const {
      name,
      description,
      base_fare,
      min_fare,
      price_per_km,
      price_per_min,
      capacity_min,
      capacity_max,
      is_luxury = false,
      is_motorcycle = false,
      is_cargo = false,
      icon_url,
      image_url,
    } = data;

    if (!name) throw new BadRequestError("Nome é obrigatório.");

    // Evitar duplicidade
    const found = await runQueryWithTenant<{ count: number }>(
      tenantId,
      {
        text: `SELECT 1 as count FROM rides_service_types WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)`,
        values: [tenantId, name],
      }
    );

    if (found) {
      throw new BadRequestError("Já existe um serviço com esse nome.");
    }

    const row = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      INSERT INTO rides_service_types (
        tenant_id, name, description,
        base_fare, min_fare, price_per_km, price_per_min,
        capacity_min, capacity_max,
        is_luxury, is_motorcycle, is_cargo,
        icon_url, image_url,
        created_at
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
      }
    );

    if (!row) {
      throw new Error('Failed to create service type');
    }

    await eventBus.emit({
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
  async updateServiceType(tenantId: string, serviceTypeId: string, patch: any) {
    const existing = await this.getServiceType(tenantId, serviceTypeId);

    const row = await runQueryWithTenant<any>(
      tenantId,
      {
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
        updated_at = now()
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
      }
    );

    if (!row) {
      throw new Error('Failed to update service type');
    }

    await eventBus.emit({
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
  async listServiceTypes(tenantId: string) {
    return runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_service_types
      WHERE tenant_id = $1
      ORDER BY name ASC
      `,
        values: [tenantId],
      }
    );
  }

  // ============================================================================
  // 🔹 4. Obter tipo
  // ============================================================================
  async getServiceType(tenantId: string, serviceTypeId: string) {
    const row = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_service_types
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
        values: [tenantId, serviceTypeId],
      }
    );

    if (!row) throw new NotFoundError("Tipo de serviço não encontrado.");
    return row;
  }

  // ============================================================================
  // 🔹 5. Deletar tipo (se não houver veículos associados)
  // ============================================================================
  async deleteServiceType(tenantId: string, serviceTypeId: string) {
    const cnt = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
      SELECT COUNT(*) as count
      FROM rides_vehicles
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
        values: [tenantId, serviceTypeId],
      }
    );

    if (cnt && +cnt.count > 0) {
      throw new BadRequestError("Não é possível excluir serviço com veículos associados.");
    }

    await runQueryWithTenant(
      tenantId,
      {
        text: `
      DELETE FROM rides_service_types
      WHERE tenant_id = $1 AND service_type_id = $2
      `,
        values: [tenantId, serviceTypeId],
      }
    );

    await eventBus.emit({
      type: "rides.service_type.deleted",
      tenantId,
      payload: {
        serviceTypeId,
      },
    });

    return { ok: true };
  }
}

export const serviceTypesService = new ServiceTypesService();
