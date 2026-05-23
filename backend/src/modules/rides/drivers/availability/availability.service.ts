/**
 * ⚠️ ESTADO OPERACIONAL — NÃO É SSOT TEMPORAL
 * Este serviço NÃO representa agenda.
 * NÃO pode ser usado para:
 * - booking
 * - disponibilidade temporal canônica
 * - conflitos de agenda
 */

// TODO: integrar com unified-availability.service
//
// 🔴 LEGADO — persistência paralela; semântica só operacional (dispatch rides), não agenda canónica.

import { runQueryWithTenant } from '@core/db';
import type { DriverAvailability } from '../../rides.types';
import type {
  SetAvailabilityInput,
  SetDestinationModeInput,
} from '../drivers.types';

/**
 * Escreve apenas estado operacional do motorista no módulo rides (online/offline, modo destino).
 * Não cria booking, não resolve conflitos de tempo e não substitui unified-availability.
 */
export class AvailabilityService {
  /** Marca motorista em operação para dispatch; não publica disponibilidade canónica nem booking. */
  async setOnline(input: SetAvailabilityInput): Promise<DriverAvailability> {
    const row = await runQueryWithTenant<DriverAvailability>(input.tenantId, {
      text: `
      INSERT INTO rides_driver_availability (
        tenant_id,
        driver_id,
        is_online,
        current_zone_id,
        current_lat,
        current_lng
      )
      VALUES ($1,$2,true,$3,$4,$5)
      ON CONFLICT (driver_id)
      DO UPDATE SET
        is_online = true,
        current_zone_id = $3,
        current_lat = $4,
        current_lng = $5,
        updated_at = now()
      RETURNING *
      `,
      values: [
        input.tenantId,
        input.driverId,
        input.zoneId ?? null,
        input.lat ?? null,
        input.lng ?? null,
      ],
    });

    return row!;
  }

  /** Encerra operação para dispatch; não cancela bookings nem altera agenda unificada. */
  async setOffline(driverId: string): Promise<DriverAvailability> {
    const row = await runQueryWithTenant<DriverAvailability>(driverId, {
      text: `
      UPDATE rides_driver_availability
      SET 
        is_online = false,
        destination_enabled = false,
        updated_at = now()
      WHERE driver_id = $1
      RETURNING *
      `,
      values: [driverId],
    });

    return row!;
  }

  /**
   * Modo destino operacional (preferência de direção para dispatch), não janela de agenda.
   * Coluna `destination_slots_remaining`: nome legado em BD — contador operacional de corridas
   * aceitas nesse modo, não “slots” de calendário.
   */
  async setDestinationMode(input: SetDestinationModeInput): Promise<DriverAvailability> {
    const row = await runQueryWithTenant<DriverAvailability>(input.tenantId, {
      text: `
      UPDATE rides_driver_availability
      SET
        destination_enabled = true,
        destination_lat = $2,
        destination_lng = $3,
        destination_deadline = $4,
        destination_slots_remaining = $5,
        updated_at = now()
      WHERE tenant_id = $1 AND driver_id = $6
      RETURNING *
      `,
      values: [
        input.tenantId,
        input.destinationLat,
        input.destinationLng,
        input.deadline,
        input.slotsRemaining,
        input.driverId,
      ],
    });

    return row!;
  }

  /** Desliga preferência de destino operacional; não libera janelas de agenda. */
  async disableDestinationMode(driverId: string, tenantId: string): Promise<DriverAvailability> {
    const row = await runQueryWithTenant<DriverAvailability>(tenantId, {
      text: `
      UPDATE rides_driver_availability
      SET
        destination_enabled = false,
        destination_lat = null,
        destination_lng = null,
        destination_deadline = null,
        updated_at = now()
      WHERE driver_id = $1 AND tenant_id = $2
      RETURNING *
      `,
      values: [driverId, tenantId],
    });

    return row!;
  }

  /** Ajusta contador operacional legado (`destination_slots_remaining`); não reserva tempo em agenda. */
  async rewardDestinationSlot(driverId: string, tenantId: string): Promise<void> {
    await runQueryWithTenant(tenantId, {
      text: `
      UPDATE rides_driver_availability
      SET destination_slots_remaining = destination_slots_remaining + 1,
          updated_at = now()
      WHERE driver_id = $1 AND tenant_id = $2
      `,
      values: [driverId, tenantId],
    });
  }

  /** Lê persistência operacional do motorista; não é leitura de agenda nem de SSOT temporal. */
  async getAvailability(driverId: string): Promise<DriverAvailability | null> {
    const row = await runQueryWithTenant<DriverAvailability>(driverId, {
      text: `SELECT * FROM rides_driver_availability WHERE driver_id = $1`,
      values: [driverId],
    });
    return row ?? null;
  }
}

export const availabilityService = new AvailabilityService();

