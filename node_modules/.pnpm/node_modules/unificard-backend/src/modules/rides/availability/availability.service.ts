// src/modules/rides/availability/availability.service.ts
// 🔴 LEGADO — Usa estrutura temporal paralela.
// 🔴 NÃO USAR EM NOVO CÓDIGO.
// 🔴 Migrar para unified-availability.service.ts
// 
// rides_driver_availability (is_online, dest_mode_enabled) representa:
// - Estado operacional do motorista (disponível para corridas)
// - NÃO bloqueia agenda temporal
// - NÃO cria booking
// - NÃO interfere em Unified Availability
// 
// Este é estado operacional, não agenda. A verdade temporal está em Unified Availability.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/db';
import { ForbiddenError, NotFoundError } from '@core/errors';
import { eventBus, EventBus } from '@core/events/event-bus';

type DriverRow = {
  driver_id: string;
  status: string;
  active_vehicle_id: string | null;
};

type LimitState = {
  can_drive: boolean;
  reason?: string | null;
};

// 🔴 FASE 2: is_online é estado operacional, não agenda temporal
type AvailabilityRow = {
  is_online: boolean;
};

export class AvailabilityService {
  constructor(private eventBusInstance: EventBus = eventBus) {}

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

    const session = await runQueryWithTenant<{ session_id: string }>(
      tenantId,
      {
        text: `
          INSERT INTO rides_driver_sessions (
            tenant_id, driver_id, vehicle_id, city_id,
            startedAt, is_forced_break
          )
          VALUES ($1, $2, $3, null, now(), false)
          ON CONFLICT (driver_id) WHERE endedAt IS NULL
          DO UPDATE SET updatedAt = now()
          RETURNING session_id
        `,
        values: [tenantId, driverId, driver.active_vehicle_id],
      }
    );

    const availability = await runQueryWithTenant(tenantId, {
      text: `
        INSERT INTO rides_driver_availability (
          tenant_id, driver_id, is_online, destination_mode_enabled,
          createdAt, updatedAt
        )
        VALUES ($1,$2,true,false,now(),now())
        ON CONFLICT (tenant_id, driver_id)
        DO UPDATE SET is_online = true, updatedAt = now()
        RETURNING *
      `,
      values: [tenantId, driverId],
    });

    await runQueryWithTenant(tenantId, {
      text: `
        INSERT INTO rides_driver_locations (
          tenant_id, driver_id, location, updatedAt
        )
        VALUES (
          $1,$2,
          ST_SetSRID(ST_MakePoint($4, $3), 4326),
          now()
        )
        ON CONFLICT (tenant_id, driver_id)
        DO UPDATE SET
          location = EXCLUDED.location,
          updatedAt = now()
      `,
      values: [tenantId, driverId, lat, lng],
    });

    await this.eventBusInstance.emit({
      type: 'rides.driver.online',
      tenantId,
      payload: { driverId },
    });

    return {
      ok: true,
      sessionId: session?.session_id,
      limit: state,
      availability,
    };
  }

  async goOffline(tenantId: string, driverId: string) {
    await runQueryWithTenant(tenantId, {
      text: `
        UPDATE rides_driver_sessions
        SET endedAt = now(), updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2 AND endedAt IS NULL
      `,
      values: [tenantId, driverId],
    });

    await runQueryWithTenant(tenantId, {
      text: `
        UPDATE rides_driver_availability
        SET is_online = false, updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
      values: [tenantId, driverId],
    });

    await this.eventBusInstance.emit({
      type: 'rides.driver.offline',
      tenantId,
      payload: { driverId },
    });

    return { ok: true };
  }

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

  async setDestinationMode(
    tenantId: string,
    driverId: string,
    enabled: boolean,
    dest?: { lat?: number; lng?: number }
  ) {
    const result = await runQueryWithTenant(tenantId, {
      text: `
        UPDATE rides_driver_availability
        SET destination_mode_enabled = $3,
            destination_mode_lat = CASE WHEN $3 THEN $4 ELSE NULL END,
            destination_mode_lng = CASE WHEN $3 THEN $5 ELSE NULL END,
            updatedAt = now()
        WHERE tenant_id = $1 AND driver_id = $2
        RETURNING *
      `,
      values: [
        tenantId,
        driverId,
        enabled,
        enabled ? dest?.lat : null,
        enabled ? dest?.lng : null,
      ],
    });

    await this.eventBusInstance.emit({
      type: 'rides.driver.destination_mode',
      tenantId,
      payload: { driverId, enabled },
    });

    return result;
  }

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
            updatedAt = now()
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

      await this.eventBusInstance.emit({
        type: 'rides.driver.forced_break',
        tenantId,
        payload: {
          driverId,
          reason: limitState?.state?.reason,
        },
      });
    }
  }

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


