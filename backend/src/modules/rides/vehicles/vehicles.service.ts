/**
 * 🚫 DEPRECATED — NÃO USAR
 *
 * Este arquivo NÃO está registrado em rides.module.ts
 * e NÃO faz parte do fluxo ativo do sistema.
 *
 * Substituto oficial:
 * backend/src/modules/rides/drivers/vehicles/vehicles.service.ts
 *
 * Motivo:
 * - Evitar duplicidade de lógica de veículos
 * - Evitar inconsistência de eventos
 * - Evitar uso acidental por novos desenvolvedores
 *
 * Status:
 * - Eventos já migrados para outbox (FASE 5)
 * - Arquivo mantido temporariamente apenas para rastreabilidade
 *
 * Ação futura:
 * - Remover completamente em PR separado após estabilização do sistema
 */

// src/modules/rides/vehicles/vehicles.service.ts

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from "@core/db";
import { BadRequestError, NotFoundError } from "@core/errors";
import { publishRideEventOutbox } from "../shared/publish-ride-event";
import { serviceTypesService } from "../service-types/service-types.service";

export class VehiclesService {

  // ============================================================================
  // 🔹 1. Criar veículo (status = pending)
  // ============================================================================
  async registerVehicle(tenantId: string, driverId: string, data: any) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    const {
      plate,
      brand,
      model,
      year,
      color,
      renavam,
      crlv_number,
      crlv_expiresAt,
      capacity,
      service_type_id,
      photos = [],
      features = {},
    } = data;

    if (!plate || !brand || !model || !year) {
      throw new BadRequestError("Dados básicos do veículo são obrigatórios.");
    }

    // Validar service type
    const serviceType = await serviceTypesService.getServiceType(
      tenantId,
      service_type_id
    );

    // Validar capacidade mínima
    if (capacity < serviceType.capacity_min) {
      throw new BadRequestError(
        `Veículo não suporta capacidade mínima do serviço: ${serviceType.capacity_min}`
      );
    }

    // Validar ano mínimo para categoria (ex: Black)
    if (serviceType.is_luxury && year < 2018) {
      throw new BadRequestError(
        "Veículos de categoria luxo devem ser ano 2018+."
      );
    }

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
      INSERT INTO rides_vehicles (
        tenant_id, driver_id,
        plate, brand, model, year, color,
        renavam, crlv_number, crlv_expiresAt,
        capacity, service_type_id,
        photos, features,
        is_active, is_approved,
        created_at
      )
      VALUES (
        $1,$2,
        $3,$4,$5,$6,$7,
        $8,$9,$10,
        $11,$12,
        $13,$14,
        false, false,
        now()
      )
      RETURNING *
      `,
        [
          tenantId,
          driverId,
          plate,
          brand,
          model,
          year,
          color,
          renavam,
          crlv_number,
          crlv_expiresAt,
          capacity,
          service_type_id,
          JSON.stringify(photos),
          JSON.stringify(features),
        ]
      );
      const vehicle = res.rows[0];
      if (!vehicle) {
        throw new Error('Failed to create vehicle');
      }
      await publishRideEventOutbox(client, {
        type: "rides.vehicle.created",
        tenantId,
        payload: {
          vehicleId: vehicle.vehicle_id,
          driverId,
        },
      });
      return vehicle;
    });
  }

  // ============================================================================
  // 🔹 2. Aprovar veículo
  // ============================================================================
  async approveVehicle(tenantId: string, vehicleId: string, adminId: string) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    return runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
      UPDATE rides_vehicles
      SET is_approved = true,
          approved_by = $3,
          approvedAt = now(),
          updated_at = now()
      WHERE tenant_id = $1 AND vehicle_id = $2
      RETURNING *
      `,
        [tenantId, vehicleId, adminId]
      );
      const updated = res.rows[0];
      if (!updated) {
        throw new Error('Vehicle not found');
      }
      await publishRideEventOutbox(client, {
        type: "rides.vehicle.approved",
        tenantId,
        payload: {
          vehicleId,
          adminId,
        },
      });
      return updated;
    });
  }

  // ============================================================================
  // 🔹 3. Rejeitar veículo
  // ============================================================================
  async rejectVehicle(tenantId: string, vehicleId: string, reason: string) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    return runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
      UPDATE rides_vehicles
      SET is_approved = false,
          rejected_reason = $3,
          updated_at = now()
      WHERE tenant_id = $1 AND vehicle_id = $2
      RETURNING *
      `,
        [tenantId, vehicleId, reason]
      );
      const updated = res.rows[0];
      if (!updated) {
        throw new Error('Vehicle not found');
      }
      await publishRideEventOutbox(client, {
        type: "rides.vehicle.rejected",
        tenantId,
        payload: {
          vehicleId,
          reason,
        },
      });
      return updated;
    });
  }

  // ============================================================================
  // 🔹 4. Ativar veículo (torna-se veículo principal)
  // ============================================================================
  async activateVehicle(tenantId: string, driverId: string, vehicleId: string) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    return runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
      UPDATE rides_vehicles
      SET is_active = false
      WHERE tenant_id = $1 AND driver_id = $2
      `,
        [tenantId, driverId]
      );

      const res = await client.query(
        `
      UPDATE rides_vehicles
      SET is_active = true, updated_at = now()
      WHERE tenant_id = $1 AND driver_id = $2 AND vehicle_id = $3
      RETURNING *
      `,
        [tenantId, driverId, vehicleId]
      );
      const updated = res.rows[0];
      if (!updated) {
        throw new Error('Vehicle not found');
      }

      await client.query(
        `
      UPDATE rides_drivers
      SET active_vehicle_id = $3
      WHERE tenant_id = $1 AND driver_id = $2
      `,
        [tenantId, driverId, vehicleId]
      );

      await publishRideEventOutbox(client, {
        type: "rides.vehicle.activated",
        tenantId,
        payload: {
          driverId,
          vehicleId,
        },
      });

      return updated;
    });
  }

  // ============================================================================
  // 🔹 5. Listar veículos de um motorista
  // ============================================================================
  async listDriverVehicles(tenantId: string, driverId: string) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    return runQueriesWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_vehicles
      WHERE tenant_id = $1 AND driver_id = $2
      ORDER BY created_at DESC
      `,
        values: [tenantId, driverId],
      }
    );
  }

  // ============================================================================
  // 🔹 6. Obter veículo
  // ============================================================================
  async getVehicle(tenantId: string, vehicleId: string) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    const row = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      SELECT *
      FROM rides_vehicles
      WHERE tenant_id = $1 AND vehicle_id = $2
      `,
        values: [tenantId, vehicleId],
      }
    );

    if (!row) throw new NotFoundError("Veículo não encontrado.");
    return row;
  }

  // ============================================================================
  // 🔹 7. Remover veículo
  // ============================================================================
  async deleteVehicle(tenantId: string, vehicleId: string) {
    throw new Error(
      'DEPRECATED_MODULE: Use drivers/vehicles/vehicles.service.ts instead'
    );
    await runTenantTransactionWithClient(tenantId, async (client) => {
      const res = await client.query(
        `
      DELETE FROM rides_vehicles
      WHERE tenant_id = $1 AND vehicle_id = $2
      RETURNING vehicle_id
      `,
        [tenantId, vehicleId]
      );
      const deleted = res.rows[0];
      if (!deleted) {
        throw new NotFoundError("Veículo não encontrado.");
      }
      await publishRideEventOutbox(client, {
        type: "rides.vehicle.deleted",
        tenantId,
        payload: {
          vehicleId,
        },
      });
    });

    return { ok: true };
  }
}

export const vehiclesService = new VehiclesService();

