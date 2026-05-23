// src/modules/rides/availability/availability.service.ts
//
/**
 * ⚠️ ESTADO OPERACIONAL — NÃO É SSOT TEMPORAL
 * Este serviço NÃO representa agenda.
 * NÃO pode ser usado para:
 * - booking
 * - disponibilidade temporal canônica
 * - conflitos de agenda
 */
//
// TODO: integrar com unified-availability.service
//
// 🔴 LEGADO — estrutura paralela ao tempo canónico; não usar em fluxo novo sem revisão explícita.
//
// `rides_driver_availability` (`is_online`, `destination_mode_*`): flags operacionais para dispatch
// de corridas (motorista em operação para novas corridas), sem semântica de agenda nem SSOT temporal.

import { runQueryWithTenant, runQueriesWithTenant, runTenantTransactionWithClient } from '@core/db';
import { ForbiddenError, NotFoundError } from '@core/errors';
import { publishRideEventOutbox } from '../shared/publish-ride-event';

type DriverRow = {
  driver_id: string;
  status: string;
  active_vehicle_id: string | null;
};

type LimitState = {
  can_drive: boolean;
  reason?: string | null;
};

/** `is_online` = estado operacional (aceite para dispatch), não agenda nem disponibilidade canónica. */
type AvailabilityRow = {
  is_online: boolean;
};

/**
 * Manipula apenas sessão operacional, localização de trabalho e flags de dispatch no domínio rides.
 * Não cria booking, não resolve sobreposição de agenda e não define disponibilidade global/canónica.
 */
export class AvailabilityService {
  /** Inicia sessão operacional e marca `is_online` para dispatch; não cria booking nem bloqueia agenda. */
  async goOnline(tenantId: string, driverId: string, lat: number, lng: number) {
    const driver = await runQueryWithTenant<DriverRow>(tenantId, {
      text: `
        SELECT driver_id, status, active_vehicle_id
        FROM rides_drivers
        WHERE tenant_id = $1 AND driver_id = $2
      `,
      values: [tenantId, driverId],
    });

    if (!driver) throw new NotFoundError('Motorista não encontrado.');
    if (driver.status !== 'approved') {
      throw new ForbiddenError('Motorista não está aprovado para operar.');
    }
    if (!driver.active_vehicle_id) {
      throw new ForbiddenError('Defina um veículo ativo antes de ficar online.');
    }

    const limitState = await runQueryWithTenant<{ state: LimitState }>(
      tenantId,
      {
        text: `SELECT rides_check_driving_limit($1, $2) AS state`,
        values: [tenantId, driverId],
      }
    );

    const state = limitState?.state;

    if (!state?.can_drive) {
      throw new ForbiddenError(
        `Motorista bloqueado: ${state?.reason || 'Limite excedido'}`
      );
    }

    const out = await runTenantTransactionWithClient(tenantId, async (client) => {
      const sessionRes = await client.query(
        `
          INSERT INTO rides_driver_sessions (
            tenant_id, driver_id, vehicle_id, city_id,
            startedAt, is_forced_break
          )
          VALUES ($1, $2, $3, null, now(), false)
          ON CONFLICT (driver_id) WHERE endedAt IS NULL
          DO UPDATE SET updated_at = now()
          RETURNING session_id
        `,
        [tenantId, driverId, driver.active_vehicle_id]
      );
      const session = sessionRes.rows[0];

      const availabilityRes = await client.query(
        `
        INSERT INTO rides_driver_availability (
          tenant_id, driver_id, is_online, destination_mode_enabled,
          updated_at
        )
        VALUES ($1,$2,true,false,now())
        ON CONFLICT (tenant_id, driver_id)
        DO UPDATE SET is_online = true, updated_at = now()
        RETURNING *
      `,
        [tenantId, driverId]
      );
      const availability = availabilityRes.rows[0];

      await client.query(
        `
        INSERT INTO rides_driver_locations (
          tenant_id, driver_id, location, updated_at
        )
        VALUES (
          $1,$2,
          ST_SetSRID(ST_MakePoint($4, $3), 4326),
          now()
        )
        ON CONFLICT (tenant_id, driver_id)
        DO UPDATE SET
          location = EXCLUDED.location,
          updated_at = now()
      `,
        [tenantId, driverId, lat, lng]
      );

      await publishRideEventOutbox(client, {
        type: 'rides.driver.online',
        tenantId,
        payload: { driverId },
      });

      return { session, availability };
    });

    return {
      ok: true,
      sessionId: out.session?.session_id,
      limit: state,
      availability: out.availability,
    };
  }

  /** Termina sessão operacional e `is_online`; não altera reservas em unified-availability. */
  async goOffline(tenantId: string, driverId: string) {
    await runTenantTransactionWithClient(tenantId, async (client) => {
      await client.query(
        `
        UPDATE rides_driver_sessions
        SET endedAt = now(), updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2 AND endedAt IS NULL
      `,
        [tenantId, driverId]
      );

      await client.query(
        `
        UPDATE rides_driver_availability
        SET is_online = false, updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
        [tenantId, driverId]
      );

      await publishRideEventOutbox(client, {
        type: 'rides.driver.offline',
        tenantId,
        payload: { driverId },
      });
    });

    return { ok: true };
  }

  /** Indica se o motorista está em operação para dispatch (flag), não disponibilidade canónica de agenda. */
  async isOnline(tenantId: string, driverId: string) {
    const row = await runQueryWithTenant<AvailabilityRow>(tenantId, {
      text: `
        SELECT is_online
        FROM rides_driver_availability
        WHERE tenant_id = $1 AND driver_id = $2
      `,
      values: [tenantId, driverId],
    });

    return !!row?.is_online;
  }

  /** Preferência operacional de destino para matching/dispatch; não é janela temporal de agenda. */
  async setDestinationMode(
    tenantId: string,
    driverId: string,
    enabled: boolean,
    dest?: { lat?: number; lng?: number }
  ) {
    return runTenantTransactionWithClient(tenantId, async (client) => {
      const resultRes = await client.query(
        `
        UPDATE rides_driver_availability
        SET destination_mode_enabled = $3,
            destination_mode_lat = CASE WHEN $3 THEN $4 ELSE NULL END,
            destination_mode_lng = CASE WHEN $3 THEN $5 ELSE NULL END,
            updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
        [
          tenantId,
          driverId,
          enabled,
          enabled ? dest?.lat : null,
          enabled ? dest?.lng : null,
        ]
      );
      const result = resultRes.rows[0];

      await publishRideEventOutbox(client, {
        type: 'rides.driver.destination_mode',
        tenantId,
        payload: { driverId, enabled },
      });

      return result;
    });
  }

  /** Acumula tempo de condução na sessão operacional (limites de jornada), não agenda de serviços. */
  async incrementDrivingTime(
    tenantId: string,
    driverId: string,
    minutes: number
  ) {
    if (minutes <= 0) return;

    await runQueryWithTenant(tenantId, {
      text: `
        UPDATE rides_driver_sessions
        SET driving_time_minutes = driving_time_minutes + $3,
            updated_at = now()
        WHERE tenant_id = $1 AND driver_id = $2 AND endedAt IS NULL
      `,
      values: [tenantId, driverId, minutes],
    });

    const limitState = await runQueryWithTenant<{ state: LimitState }>(
      tenantId,
      {
        text: `SELECT rides_check_driving_limit($1, $2) AS state`,
        values: [tenantId, driverId],
      }
    );

    if (!limitState?.state?.can_drive) {
      await this.goOffline(tenantId, driverId);

      await runTenantTransactionWithClient(tenantId, async (client) => {
        await publishRideEventOutbox(client, {
          type: 'rides.driver.forced_break',
          tenantId,
          payload: {
            driverId,
            reason: limitState?.state?.reason,
          },
        });
      });
    }
  }

  /** Agrega estado operacional persistido (sessão, flags, destinos operacionais); não é visão de agenda. */
  async getStatus(tenantId: string, driverId: string) {
    const availability = await runQueryWithTenant<any>(tenantId, {
      text: `
        SELECT *
        FROM rides_driver_availability
        WHERE tenant_id = $1 AND driver_id = $2
      `,
      values: [tenantId, driverId],
    });

    const session = await runQueryWithTenant<any>(tenantId, {
      text: `
        SELECT *
        FROM rides_driver_sessions
        WHERE tenant_id = $1 AND driver_id = $2
        ORDER BY startedAt DESC
        LIMIT 1
      `,
      values: [tenantId, driverId],
    });

    const destinations = await runQueriesWithTenant<any>(tenantId, {
      text: `
        SELECT destination_id, lat, lng, expiresAt
        FROM rides_driver_destinations
        WHERE tenant_id = $1 AND driver_id = $2
        ORDER BY expiresAt DESC
      `,
      values: [tenantId, driverId],
    });

    return {
      availability,
      session,
      destinations,
    };
  }
}

export const availabilityService = new AvailabilityService();
