// src/modules/rides/drivers/drivers.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from "@core/db";
import { eventBus } from "@core/events/event-bus";
import { BadRequestError, NotFoundError, ForbiddenError } from "@core/errors";

export class DriversService {

  // ============================================================================
  // 🔹 1. Criar motorista (status = pending)
  // ============================================================================
  async createDriver(tenantId: string, userId: string) {
    const exists = await runQueryWithTenant<{ driver_id: string }>(tenantId, {
      text: `
      SELECT driver_id 
      FROM rides_drivers
      WHERE tenant_id = $1 AND user_id = $2
      `,
      values: [tenantId, userId],
    });

    if (exists) throw new BadRequestError("Usuário já é motorista.");

    const driver = await runQueryWithTenant<any>(tenantId, {
      text: `
        INSERT INTO rides_drivers (
          tenant_id, user_id,
          status, level,
          createdAt
        )
        VALUES ($1,$2,'pending','bronze',now())
        RETURNING *
      `,
      values: [tenantId, userId],
    });

    await eventBus.emit({
      type: "rides.driver.created",
      tenantId,
      payload: {
        driverId: driver?.driver_id,
        userId,
      },
    });

    return driver;
  }

  // ============================================================================
  // 🔹 2. Enviar documento (CNH, ER, CRLV)
  // ============================================================================
  async uploadDriverDocument(tenantId: string, driverId: string, payload: any) {
    const { type, number, expiresAt, fileUrl, extra } = payload;

    if (!["cnh", "er", "crlv"].includes(type)) {
      throw new BadRequestError("Tipo de documento inválido.");
    }

    await runQueryWithTenant(tenantId, {
      text: `
        INSERT INTO rides_driver_documents (
          tenant_id, driver_id, type,
          number, expiresAt, file_url, extra,
          createdAt
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7, now())
        ON CONFLICT (tenant_id, driver_id, type)
        DO UPDATE SET
          number = EXCLUDED.number,
          expiresAt = EXCLUDED.expiresAt,
          file_url = EXCLUDED.file_url,
          extra = EXCLUDED.extra,
          updatedAt = now()
      `,
      values: [tenantId, driverId, type, number, expiresAt, fileUrl, extra || {}],
    });

    await eventBus.emit({
      type: "rides.driver.document_uploaded",
      tenantId,
      payload: { driverId, type },
    });

    return { ok: true };
  }

  // ============================================================================
  // 🔹 3. Validar documentos e aprovar motorista
  // ============================================================================
  async approveDriver(tenantId: string, driverId: string) {
    const docs = await runQueriesWithTenant<{ type: string; expiresAt: string }>(
      tenantId,
      {
        text: `
          SELECT type, expiresAt
          FROM rides_driver_documents
          WHERE tenant_id = $1 AND driver_id = $2
        `,
        values: [tenantId, driverId],
      }
    );

    const required = ["cnh", "er"];

    for (const r of required) {
      const doc = docs.find((d) => d.type === r);
      if (!doc) throw new BadRequestError(`Documento obrigatório faltando: ${r}`);
      if (new Date(doc.expiresAt) < new Date()) {
        throw new BadRequestError(`Documento expirado: ${r}`);
      }
    }

    const updated = await runQueryWithTenant<any>(tenantId, {
      text: `
        UPDATE rides_drivers
        SET status = 'approved', updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
      values: [tenantId, driverId],
    });

    await eventBus.emit({
      type: "rides.driver.approved",
      tenantId,
      payload: { driverId },
    });

    return updated;
  }

  // ============================================================================
  // 🔹 4. Suspender motorista
  // ============================================================================
  async suspendDriver(tenantId: string, driverId: string, reason: string) {
    const updated = await runQueryWithTenant<any>(tenantId, {
      text: `
        UPDATE rides_drivers
        SET status = 'suspended', updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
      values: [tenantId, driverId],
    });

    await eventBus.emit({
      type: "rides.driver.suspended",
      tenantId,
      payload: { driverId, reason },
    });

    return updated;
  }

  // ============================================================================
  // 🔹 5. Atualizar CNH/ER vencidos
  // ============================================================================
  async checkExpiredDocuments(tenantId: string) {
    const expired = await runQueriesWithTenant<{ driver_id: string; type: string }>(
      tenantId,
      {
        text: `
          SELECT driver_id, type, expiresAt
          FROM rides_driver_documents
          WHERE tenant_id = $1
            AND expiresAt < now()
        `,
        values: [tenantId],
      }
    );

    for (const doc of expired) {
      await this.suspendDriver(
        tenantId,
        doc.driver_id,
        `Documento vencido: ${doc.type}`
      );

      await eventBus.emit({
        type: "rides.driver.documents.expired",
        tenantId,
        payload: { driverId: doc.driver_id, type: doc.type },
      });
    }

    return expired.length;
  }

  // ============================================================================
  // 🔹 6. Motorista só pode operar se estiver aprovado + veículo ativo
  // ============================================================================
  async ensureDriverCanOperate(tenantId: string, driverId: string) {
    const row = await runQueryWithTenant<any>(tenantId, {
      text: `
        SELECT d.driver_id, d.status, d.active_vehicle_id, v.is_approved
        FROM rides_drivers d
        LEFT JOIN rides_vehicles v
          ON v.tenant_id = d.tenant_id
         AND v.vehicle_id = d.active_vehicle_id
        WHERE d.tenant_id = $1 AND d.driver_id = $2
      `,
      values: [tenantId, driverId],
    });

    if (!row) throw new NotFoundError("Motorista não encontrado.");
    if (row.status !== "approved") {
      throw new ForbiddenError("Motorista não está aprovado.");
    }
    if (!row.active_vehicle_id || !row.is_approved) {
      throw new ForbiddenError("Veículo não aprovado/ausente.");
    }

    return true;
  }

  // ============================================================================
  // 🔹 7. Listar motoristas
  // ============================================================================
  async listDrivers(tenantId: string) {
    return runQueriesWithTenant<any>(tenantId, {
      text: `
        SELECT d.driver_id, d.user_id, d.status, d.level,
          d.active_vehicle_id,
          (SELECT COUNT(*) FROM rides_rides r 
            WHERE r.tenant_id = d.tenant_id 
              AND r.driver_id = d.driver_id 
              AND r.status = 'completed'
          ) AS total_rides
        FROM rides_drivers d
        WHERE d.tenant_id = $1
        ORDER BY d.createdAt DESC
      `,
      values: [tenantId],
    });
  }

  async updateDriver(tenantId: string, driverId: string, patch: any) {
    const updated = await runQueryWithTenant<any>(tenantId, {
      text: `
        UPDATE rides_drivers
        SET
          status = COALESCE($3, status),
          level = COALESCE($4, level),
          active_vehicle_id = COALESCE($5, active_vehicle_id),
          updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
      values: [tenantId, driverId, patch.status, patch.level, patch.active_vehicle_id],
    });

    if (!updated) throw new NotFoundError("Motorista não encontrado.");
    return updated;
  }

  async getDriverByUserId(tenantId: string, userId: string) {
    return runQueryWithTenant<any>(tenantId, {
      text: `
        SELECT *
        FROM rides_drivers
        WHERE tenant_id = $1 AND user_id = $2
        LIMIT 1
      `,
      values: [tenantId, userId],
    });
  }
}

export const driversService = new DriversService();

