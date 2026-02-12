"use strict";
// src/modules/rides/drivers/drivers.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.driversService = exports.DriversService = void 0;
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
class DriversService {
    // ============================================================================
    // 🔹 1. Criar motorista (status = pending)
    // ============================================================================
    async createDriver(tenantId, userId) {
        const exists = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
      SELECT driver_id 
      FROM rides_drivers
      WHERE tenant_id = $1 AND user_id = $2
      `,
            values: [tenantId, userId],
        });
        if (exists)
            throw new errors_1.BadRequestError("Usuário já é motorista.");
        const driver = await (0, db_1.runQueryWithTenant)(tenantId, {
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
        await event_bus_1.eventBus.emit({
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
    async uploadDriverDocument(tenantId, driverId, payload) {
        const { type, number, expiresAt, fileUrl, extra } = payload;
        if (!["cnh", "er", "crlv"].includes(type)) {
            throw new errors_1.BadRequestError("Tipo de documento inválido.");
        }
        await (0, db_1.runQueryWithTenant)(tenantId, {
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
        await event_bus_1.eventBus.emit({
            type: "rides.driver.document_uploaded",
            tenantId,
            payload: { driverId, type },
        });
        return { ok: true };
    }
    // ============================================================================
    // 🔹 3. Validar documentos e aprovar motorista
    // ============================================================================
    async approveDriver(tenantId, driverId) {
        const docs = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          SELECT type, expiresAt
          FROM rides_driver_documents
          WHERE tenant_id = $1 AND driver_id = $2
        `,
            values: [tenantId, driverId],
        });
        const required = ["cnh", "er"];
        for (const r of required) {
            const doc = docs.find((d) => d.type === r);
            if (!doc)
                throw new errors_1.BadRequestError(`Documento obrigatório faltando: ${r}`);
            if (new Date(doc.expiresAt) < new Date()) {
                throw new errors_1.BadRequestError(`Documento expirado: ${r}`);
            }
        }
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_drivers
        SET status = 'approved', updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
            values: [tenantId, driverId],
        });
        await event_bus_1.eventBus.emit({
            type: "rides.driver.approved",
            tenantId,
            payload: { driverId },
        });
        return updated;
    }
    // ============================================================================
    // 🔹 4. Suspender motorista
    // ============================================================================
    async suspendDriver(tenantId, driverId, reason) {
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        UPDATE rides_drivers
        SET status = 'suspended', updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
            values: [tenantId, driverId],
        });
        await event_bus_1.eventBus.emit({
            type: "rides.driver.suspended",
            tenantId,
            payload: { driverId, reason },
        });
        return updated;
    }
    // ============================================================================
    // 🔹 5. Atualizar CNH/ER vencidos
    // ============================================================================
    async checkExpiredDocuments(tenantId) {
        const expired = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
          SELECT driver_id, type, expiresAt
          FROM rides_driver_documents
          WHERE tenant_id = $1
            AND expiresAt < now()
        `,
            values: [tenantId],
        });
        for (const doc of expired) {
            await this.suspendDriver(tenantId, doc.driver_id, `Documento vencido: ${doc.type}`);
            await event_bus_1.eventBus.emit({
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
    async ensureDriverCanOperate(tenantId, driverId) {
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
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
        if (!row)
            throw new errors_1.NotFoundError("Motorista não encontrado.");
        if (row.status !== "approved") {
            throw new errors_1.ForbiddenError("Motorista não está aprovado.");
        }
        if (!row.active_vehicle_id || !row.is_approved) {
            throw new errors_1.ForbiddenError("Veículo não aprovado/ausente.");
        }
        return true;
    }
    // ============================================================================
    // 🔹 7. Listar motoristas
    // ============================================================================
    async listDrivers(tenantId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
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
    async updateDriver(tenantId, driverId, patch) {
        const updated = await (0, db_1.runQueryWithTenant)(tenantId, {
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
        if (!updated)
            throw new errors_1.NotFoundError("Motorista não encontrado.");
        return updated;
    }
    async getDriverByUserId(tenantId, userId) {
        return (0, db_1.runQueryWithTenant)(tenantId, {
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
exports.DriversService = DriversService;
exports.driversService = new DriversService();
