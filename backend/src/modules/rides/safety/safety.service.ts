// src/modules/rides/safety/safety.service.ts

import { randomUUID } from "crypto";
import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from "@core/db";
import { publishRideEventOutbox } from "../shared/publish-ride-event";
import { BadRequestError, NotFoundError } from "@core/errors";
import { notifyService } from "@core/notify/notify.service";

interface EmergencyContactRow {
  contact_id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  phone: string;
  created_at: Date;
}

export class SafetyService {
  // ============================================================================
  // 🔹 1. Adicionar contato de emergência
  // ============================================================================
  async addEmergencyContact(tenantId: string, userId: string, contact: any) {
    const { name, phone } = contact;

    if (!name || !phone) {
      throw new BadRequestError("Nome e telefone são obrigatórios.");
    }

    const row = await runQueryWithTenant<EmergencyContactRow>(tenantId, {
      text: `
        INSERT INTO rides_emergency_contacts (
          tenant_id, user_id, name, phone, created_at
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
  async listEmergencyContacts(tenantId: string, userId: string) {
    return runQueriesWithTenant<EmergencyContactRow>(tenantId, {
      text: `
        SELECT *
        FROM rides_emergency_contacts
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY created_at DESC
      `,
      values: [tenantId, userId],
    });
  }

  // ============================================================================
  // 🔹 3. Remover contato de emergência
  // ============================================================================
  async removeEmergencyContact(tenantId: string, contactId: string) {
    // Verificar se o contato existe antes de deletar
    const existing = await runQueryWithTenant<{ contact_id: string }>(tenantId, {
      text: `
        SELECT contact_id
        FROM rides_emergency_contacts
        WHERE tenant_id = $1 AND contact_id = $2
        LIMIT 1
      `,
      values: [tenantId, contactId],
    });

    if (!existing) {
      throw new NotFoundError("Contato não encontrado.");
    }

    // Deletar o contato
    await runQueryWithTenant(tenantId, {
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
  async triggerSOS(tenantId: string, userId: string, rideId: string) {
    // Busca localização atual do passageiro ou motorista
    const ride = await runQueryWithTenant<{
      ride_id: string;
      driver_id: string;
      passenger_user_id: string;
    }>(tenantId, {
      text: `
        SELECT r.ride_id, r.driver_id, r.passenger_user_id
        FROM rides_rides r
        WHERE tenant_id = $1 AND ride_id = $2
      `,
      values: [tenantId, rideId],
    });

    if (!ride) throw new NotFoundError("Corrida não encontrada.");

    // Buscar contatos para acionar
    const contacts = await this.listEmergencyContacts(
      tenantId,
      userId
    );

    const alert = await runTenantTransactionWithClient(tenantId, async (client) => {
      const alertRes = await client.query(
        `
        INSERT INTO rides_safety_alerts (
          tenant_id, ride_id, triggered_by_user_id,
          created_at
        )
        VALUES ($1, $2, $3, now())
        RETURNING alert_id
      `,
        [tenantId, rideId, userId]
      );
      const a = alertRes.rows[0];
      if (!a) {
        throw new Error("Failed to create safety alert");
      }
      await publishRideEventOutbox(client, {
        type: "rides.safety.sos_triggered",
        tenantId,
        payload: {
          rideId,
          triggeredBy: userId,
        },
      });
      return a;
    });

    for (const c of contacts) {
      await notifyService.send({
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

    return { ok: true, alertId: alert.alert_id };
  }

  // ============================================================================
  // 🔹 5. Compartilhar rota (link temporário)
  // ============================================================================
  async shareRide(tenantId: string, rideId: string, userId: string) {
    const token = randomUUID();

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const shareRes = await client.query(
        `
        INSERT INTO rides_ride_shares (
          tenant_id, ride_id, user_id,
          share_token, share_url,
          expiresAt, created_at
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
        [tenantId, rideId, userId, token]
      );
      const row = shareRes.rows[0];
      if (!row) {
        throw new Error("Failed to create ride share");
      }
      await publishRideEventOutbox(client, {
        type: "rides.ride.shared",
        tenantId,
        payload: {
          rideId,
          userId,
          token,
        },
      });
      return row;
    });
  }

  // ============================================================================
  // 🔹 6. Registrar disputa da corrida
  // ============================================================================
  async openDispute(tenantId: string, rideId: string, userId: string, reason: string, details?: any) {
    if (!reason) {
      throw new BadRequestError("Motivo da disputa é obrigatório.");
    }

    const ride = await runQueryWithTenant<{ ride_id: string }>(tenantId, {
      text: `
        SELECT ride_id
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
      values: [tenantId, rideId],
    });

    if (!ride) throw new NotFoundError("Corrida não encontrada.");

    return runTenantTransactionWithClient(tenantId, async (client) => {
      const disputeRes = await client.query(
        `
        INSERT INTO rides_disputes (
          tenant_id, ride_id, opened_by_user_id,
          reason, details, status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'open', now())
        RETURNING *
      `,
        [tenantId, rideId, userId, reason, details || {}]
      );
      const dispute = disputeRes.rows[0];
      if (!dispute) {
        throw new Error("Failed to create dispute");
      }
      await publishRideEventOutbox(client, {
        type: "rides.dispute.opened",
        tenantId,
        payload: {
          rideId,
          userId,
          reason,
        },
      });
      return dispute;
    });
  }

  // ============================================================================
  // 🔹 7. Listar compartilhamentos de uma corrida
  // ============================================================================
  async listRideShares(tenantId: string, rideId: string) {
    return runQueriesWithTenant<{
      share_id: string;
      tenant_id: string;
      ride_id: string;
      user_id: string;
      share_token: string;
      share_url: string;
      expiresAt: Date;
      created_at: Date;
    }>(tenantId, {
      text: `
        SELECT *
        FROM rides_ride_shares
        WHERE tenant_id = $1 AND ride_id = $2
        ORDER BY created_at DESC
      `,
      values: [tenantId, rideId],
    });
  }

  // ============================================================================
  // 🔹 8. Listar disputas de uma corrida
  // ============================================================================
  async listRideDisputes(tenantId: string, rideId: string) {
    return runQueriesWithTenant<{
      dispute_id: string;
      tenant_id: string;
      ride_id: string;
      opened_by_user_id: string;
      reason: string;
      details: any;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>(tenantId, {
      text: `
        SELECT *
        FROM rides_disputes
        WHERE tenant_id = $1 AND ride_id = $2
        ORDER BY created_at DESC
      `,
      values: [tenantId, rideId],
    });
  }
}

export const safetyService = new SafetyService();

