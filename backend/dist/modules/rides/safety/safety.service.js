"use strict";
// src/modules/rides/safety/safety.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.safetyService = exports.SafetyService = void 0;
const crypto_1 = require("crypto");
const db_1 = require("@core/db");
const event_bus_1 = require("@core/events/event-bus");
const errors_1 = require("@core/errors");
const notify_service_1 = require("@core/notify/notify.service");
class SafetyService {
    // ============================================================================
    // 🔹 1. Adicionar contato de emergência
    // ============================================================================
    async addEmergencyContact(tenantId, userId, contact) {
        const { name, phone } = contact;
        if (!name || !phone) {
            throw new errors_1.BadRequestError("Nome e telefone são obrigatórios.");
        }
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_emergency_contacts (
          tenant_id, user_id, name, phone, createdAt
        )
        VALUES ($1, $2, $3, $4, now())
        RETURNING *
      `,
            values: [tenantId, userId, name, phone],
        });
        if (!row) {
            throw new Error("Failed to create emergency contact");
        }
        return row;
    }
    // ============================================================================
    // 🔹 2. Listar contatos de emergência
    // ============================================================================
    async listEmergencyContacts(tenantId, userId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_emergency_contacts
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY createdAt DESC
      `,
            values: [tenantId, userId],
        });
    }
    // ============================================================================
    // 🔹 3. Remover contato de emergência
    // ============================================================================
    async removeEmergencyContact(tenantId, contactId) {
        // Verificar se o contato existe antes de deletar
        const existing = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT contact_id
        FROM rides_emergency_contacts
        WHERE tenant_id = $1 AND contact_id = $2
        LIMIT 1
      `,
            values: [tenantId, contactId],
        });
        if (!existing) {
            throw new errors_1.NotFoundError("Contato não encontrado.");
        }
        // Deletar o contato
        await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        DELETE FROM rides_emergency_contacts
        WHERE tenant_id = $1 AND contact_id = $2
      `,
            values: [tenantId, contactId],
        });
        return { ok: true };
    }
    // ============================================================================
    // 🔹 4. Gatilho SOS durante corrida
    // ============================================================================
    async triggerSOS(tenantId, userId, rideId) {
        // Busca localização atual do passageiro ou motorista
        const ride = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT r.ride_id, r.driver_id, r.passenger_user_id
        FROM rides_rides r
        WHERE tenant_id = $1 AND ride_id = $2
      `,
            values: [tenantId, rideId],
        });
        if (!ride)
            throw new errors_1.NotFoundError("Corrida não encontrada.");
        // Buscar contatos para acionar
        const contacts = await this.listEmergencyContacts(tenantId, userId);
        // Criar alerta interno para painel de segurança
        const alert = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_safety_alerts (
          tenant_id, ride_id, triggered_by_user_id,
          createdAt
        )
        VALUES ($1, $2, $3, now())
        RETURNING alert_id
      `,
            values: [tenantId, rideId, userId],
        });
        if (!alert) {
            throw new Error("Failed to create safety alert");
        }
        // Enviar notificações
        for (const c of contacts) {
            await notify_service_1.notifyService.send({
                tenantId,
                userId: null,
                channel: 'sms',
                to: c.phone,
                templateName: "safety_sos_alert",
                data: {
                    rideId,
                    userId,
                },
            });
        }
        // Eventos internos
        await event_bus_1.eventBus.emit({
            type: "rides.safety.sos_triggered",
            tenantId,
            payload: {
                rideId,
                triggeredBy: userId,
            },
        });
        return { ok: true, alertId: alert.alert_id };
    }
    // ============================================================================
    // 🔹 5. Compartilhar rota (link temporário)
    // ============================================================================
    async shareRide(tenantId, rideId, userId) {
        const token = (0, crypto_1.randomUUID)();
        const row = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_ride_shares (
          tenant_id, ride_id, user_id,
          share_token, share_url,
          expiresAt, createdAt
        )
        VALUES (
          $1, $2, $3,
          $4,
          CONCAT('https://unifyrides.app/share/', $4),
          now() + interval '2 hours',
          now()
        )
        RETURNING *
      `,
            values: [tenantId, rideId, userId, token],
        });
        if (!row) {
            throw new Error("Failed to create ride share");
        }
        await event_bus_1.eventBus.emit({
            type: "rides.ride.shared",
            tenantId,
            payload: {
                rideId,
                userId,
                token,
            },
        });
        return row;
    }
    // ============================================================================
    // 🔹 6. Registrar disputa da corrida
    // ============================================================================
    async openDispute(tenantId, rideId, userId, reason, details) {
        if (!reason) {
            throw new errors_1.BadRequestError("Motivo da disputa é obrigatório.");
        }
        const ride = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT ride_id
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
            values: [tenantId, rideId],
        });
        if (!ride)
            throw new errors_1.NotFoundError("Corrida não encontrada.");
        const dispute = await (0, db_1.runQueryWithTenant)(tenantId, {
            text: `
        INSERT INTO rides_disputes (
          tenant_id, ride_id, opened_by_user_id,
          reason, details, status,
          createdAt
        )
        VALUES ($1, $2, $3, $4, $5, 'open', now())
        RETURNING *
      `,
            values: [tenantId, rideId, userId, reason, details || {}],
        });
        if (!dispute) {
            throw new Error("Failed to create dispute");
        }
        await event_bus_1.eventBus.emit({
            type: "rides.dispute.opened",
            tenantId,
            payload: {
                rideId,
                userId,
                reason,
            },
        });
        return dispute;
    }
    // ============================================================================
    // 🔹 7. Listar compartilhamentos de uma corrida
    // ============================================================================
    async listRideShares(tenantId, rideId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_ride_shares
        WHERE tenant_id = $1 AND ride_id = $2
        ORDER BY createdAt DESC
      `,
            values: [tenantId, rideId],
        });
    }
    // ============================================================================
    // 🔹 8. Listar disputas de uma corrida
    // ============================================================================
    async listRideDisputes(tenantId, rideId) {
        return (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT *
        FROM rides_disputes
        WHERE tenant_id = $1 AND ride_id = $2
        ORDER BY createdAt DESC
      `,
            values: [tenantId, rideId],
        });
    }
}
exports.SafetyService = SafetyService;
exports.safetyService = new SafetyService();
