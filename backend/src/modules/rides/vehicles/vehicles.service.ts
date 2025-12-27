// src/modules/rides/vehicles/vehicles.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from "@core/db";
import { eventBus } from "@core/events/event-bus";
import { BadRequestError, NotFoundError } from "@core/errors";
import { driversService } from "../drivers/drivers.service";
import { serviceTypesService } from "../service-types/service-types.service";

export class VehiclesService {

  // ============================================================================
  // 🔹 1. Criar veículo (status = pending)
  // ============================================================================
  async registerVehicle(tenantId: string, driverId: string, data: any) {
    const {
      plate,
      brand,
      model,
      year,
      color,
      renavam,
      crlv_number,
      crlv_expires_at,
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

    // Criar veículo
    const vehicle = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      INSERT INTO rides_vehicles (
        tenant_id, driver_id,
        plate, brand, model, year, color,
        renavam, crlv_number, crlv_expires_at,
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
        values: [
          tenantId,
          driverId,
          plate,
          brand,
          model,
          year,
          color,
          renavam,
          crlv_number,
          crlv_expires_at,
          capacity,
          service_type_id,
          JSON.stringify(photos),
          JSON.stringify(features),
        ],
      }
    );

    if (!vehicle) {
      throw new Error('Failed to create vehicle');
    }

    await eventBus.emit({
      type: "rides.vehicle.created",
      tenantId,
      payload: {
        vehicleId: vehicle.vehicle_id,
        driverId,
      },
    });

    return vehicle;
  }

  // ============================================================================
  // 🔹 2. Aprovar veículo
  // ============================================================================
  async approveVehicle(tenantId: string, vehicleId: string, adminId: string) {
    const updated = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      UPDATE rides_vehicles
      SET is_approved = true,
          approved_by = $3,
          approved_at = now(),
          updated_at = now()
      WHERE tenant_id = $1 AND vehicle_id = $2
      RETURNING *
      `,
        values: [tenantId, vehicleId, adminId],
      }
    );

    if (!updated) {
      throw new Error('Vehicle not found');
    }

    await eventBus.emit({
      type: "rides.vehicle.approved",
      tenantId,
      payload: {
        vehicleId,
        adminId,
      },
    });

    return updated;
  }

  // ============================================================================
  // 🔹 3. Rejeitar veículo
  // ============================================================================
  async rejectVehicle(tenantId: string, vehicleId: string, reason: string) {
    const updated = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      UPDATE rides_vehicles
      SET is_approved = false,
          rejected_reason = $3,
          updated_at = now()
      WHERE tenant_id = $1 AND vehicle_id = $2
      RETURNING *
      `,
        values: [tenantId, vehicleId, reason],
      }
    );

    if (!updated) {
      throw new Error('Vehicle not found');
    }

    await eventBus.emit({
      type: "rides.vehicle.rejected",
      tenantId,
      payload: {
        vehicleId,
        reason,
      },
    });

    return updated;
  }

  // ============================================================================
  // 🔹 4. Ativar veículo (torna-se veículo principal)
  // ============================================================================
  async activateVehicle(tenantId: string, driverId: string, vehicleId: string) {
    // Desativar veículo anterior
    await runQueryWithTenant(
      tenantId,
      {
        text: `
      UPDATE rides_vehicles
      SET is_active = false
      WHERE tenant_id = $1 AND driver_id = $2
      `,
        values: [tenantId, driverId],
      }
    );

    // Ativar o novo
    const updated = await runQueryWithTenant<any>(
      tenantId,
      {
        text: `
      UPDATE rides_vehicles
      SET is_active = true, updated_at = now()
      WHERE tenant_id = $1 AND driver_id = $2 AND vehicle_id = $3
      RETURNING *
      `,
        values: [tenantId, driverId, vehicleId],
      }
    );

    if (!updated) {
      throw new Error('Vehicle not found');
    }

    // Atualizar motorista
    await runQueryWithTenant(
      tenantId,
      {
        text: `
      UPDATE rides_drivers
      SET active_vehicle_id = $3
      WHERE tenant_id = $1 AND driver_id = $2
      `,
        values: [tenantId, driverId, vehicleId],
      }
    );

    await eventBus.emit({
      type: "rides.vehicle.activated",
      tenantId,
      payload: {
        driverId,
        vehicleId,
      },
    });

    return updated;
  }

  // ============================================================================
  // 🔹 5. Listar veículos de um motorista
  // ============================================================================
  async listDriverVehicles(tenantId: string, driverId: string) {
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
    const deleted = await runQueryWithTenant<{ vehicle_id: string }>(
      tenantId,
      {
        text: `
      DELETE FROM rides_vehicles
      WHERE tenant_id = $1 AND vehicle_id = $2
      RETURNING vehicle_id
      `,
        values: [tenantId, vehicleId],
      }
    );

    if (!deleted) {
      throw new NotFoundError("Veículo não encontrado.");
    }

    await eventBus.emit({
      type: "rides.vehicle.deleted",
      tenantId,
      payload: {
        vehicleId,
      },
    });

    return { ok: true };
  }
}

export const vehiclesService = new VehiclesService();
