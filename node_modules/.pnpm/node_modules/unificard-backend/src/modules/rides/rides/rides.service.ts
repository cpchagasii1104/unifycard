// src/modules/rides/rides/rides.service.ts
// SPRINT 4: INTEGRATED WITH UNIFY BANK

import { runQueryWithTenant, runQueriesWithTenant } from '@core/db';
import { eventBus } from '@core/events/event-bus';
import { BadRequestError, ForbiddenError, NotFoundError } from '@core/errors';
import { pricingService } from '../pricing/pricing.service';
import { distributionService } from '../distribution/distribution.service';
import { reviewService } from '@core/reviews/review.service';
import { bankIntegrationService } from '../../bank/bank-integration.service';

interface RideRequestRow {
  request_id: string;
  tenant_id: string;
  passenger_user_id: string;
  service_type_id: string;
  passenger_count: number;
  origin: any;
  destination: any;
  stops: any;
  status: string;
}

interface RideRow {
  ride_id: string;
  tenant_id: string;
  request_id: string;
  passenger_user_id: string;
  driver_id: string;
  service_type_id: string;
  passenger_count: number;
  origin: any;
  destination: any;
  stops: any;
  status: string;
  final_price?: number;
  driver_arrivedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancel_reason?: string;
  cancelled_by?: string;
}

interface RideStopRow {
  stop_id: string;
  tenant_id: string;
  ride_id: string;
  stop_order: number;
  status: string;
  completedAt?: Date;
}

export class RidesService {

  // ============================================================================================
  // 🔹 1. Criar ride a partir do request
  // ============================================================================================
  async createRideFromRequest(tenantId: string, requestId: string, driverId: string) {
    const req = await runQueryWithTenant<RideRequestRow>(tenantId, {
      text: `
        SELECT *
        FROM rides_ride_requests
        WHERE tenant_id = $1 AND request_id = $2
      `,
      values: [tenantId, requestId],
    });

    if (!req) throw new NotFoundError('Request não encontrada.');
    if (req.status !== 'assigned') {
      throw new BadRequestError('Request ainda não foi aceita por um motorista.');
    }

    // Criar ride
    const ride = await runQueryWithTenant<RideRow>(tenantId, {
      text: `
        INSERT INTO rides_rides (
          tenant_id, request_id, passenger_user_id,
          driver_id, service_type_id,
          passenger_count,
          origin, destination, stops,
          status, createdAt
        )
        VALUES (
          $1, $2, $3,
          $4, $5,
          $6,
          $7, $8, $9,
          'driver_assigned', now()
        )
        RETURNING *
      `,
      values: [
        tenantId,
        requestId,
        req.passenger_user_id,
        driverId,
        req.service_type_id,
        req.passenger_count,
        req.origin,
        req.destination,
        req.stops,
      ],
    });

    if (!ride) {
      throw new Error('Failed to create ride');
    }

    // Emitir evento
    await eventBus.emit({
      type: 'rides.ride.driver_assigned',
      tenantId,
      payload: {
        rideId: ride.ride_id,
        requestId,
        driverId,
      },
    });

    return ride;
  }

  // ============================================================================================
  // 🔹 2. Motorista chegou
  // ============================================================================================
  async markDriverArrived(tenantId: string, rideId: string) {
    const ride = await this.getRide(tenantId, rideId);

    const updated = await runQueryWithTenant<RideRow>(tenantId, {
      text: `
        UPDATE rides_rides
        SET status = 'driver_arrived',
            driver_arrivedAt = now(),
            updatedAt = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
      values: [tenantId, rideId],
    });

    if (!updated) {
      throw new Error('Failed to update ride status');
    }

    await eventBus.emit({
      type: 'rides.ride.driver_arrived',
      tenantId,
      payload: {
        rideId,
      },
    });

    return updated;
  }

  // ============================================================================================
  // 🔹 3. Começar corrida
  // ============================================================================================
  async startRide(tenantId: string, rideId: string) {
    const ride = await this.getRide(tenantId, rideId);

    if (ride.status !== 'driver_arrived') {
      throw new BadRequestError('Corrida ainda não está pronta para iniciar.');
    }

    const updated = await runQueryWithTenant<RideRow>(tenantId, {
      text: `
        UPDATE rides_rides
        SET status = 'in_progress',
            startedAt = now(),
            updatedAt = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
      values: [tenantId, rideId],
    });

    if (!updated) {
      throw new Error('Failed to start ride');
    }

    await eventBus.emit({
      type: 'rides.ride.started',
      tenantId,
      payload: {
        rideId,
      },
    });

    return updated;
  }

  // ============================================================================================
  // 🔹 4. Completar corrida
  // ============================================================================================
  async completeRide(tenantId: string, rideId: string) {
    const ride = await this.getRide(tenantId, rideId);

    if (ride.status !== 'in_progress') {
      throw new BadRequestError('Corrida não está em andamento.');
    }

    // Calcular preço final
    const price = await pricingService.calculateFinalPrice(tenantId, rideId);

    const updated = await runQueryWithTenant<RideRow>(tenantId, {
      text: `
        UPDATE rides_rides
        SET status = 'completed',
            completedAt = now(),
            final_price = $3,
            updatedAt = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
      values: [tenantId, rideId, price.total],
    });

    if (!updated) {
      throw new Error('Failed to complete ride');
    }

    await eventBus.emit({
      type: 'rides.ride.completed',
      tenantId,
      payload: {
        rideId,
        finalPrice: price.total,
      },
    });

    // Processar pagamento (Economy + Distribution)
    await distributionService.processRidePayment(
      tenantId,
      updated,
      price
    );

    // Emitir evento de pagamento concluído
    await eventBus.emit({
      type: 'rides.ride.paid',
      tenantId,
      payload: {
        rideId,
      },
    });

    return {
      ride: updated,
      price,
    };
  }

  // ============================================================================================
  // 🔹 5. Cancelar corrida (SPRINT 4: COM REVERSÃO DE TRANSAÇÃO)
  // ============================================================================================
  async cancelRide(tenantId: string, rideId: string, reason: string, cancelledBy: 'driver' | 'passenger') {
    const ride = await this.getRide(tenantId, rideId);

    if (ride.status === 'completed') {
      throw new BadRequestError('Corrida já foi finalizada.');
    }

    // SPRINT 4: Reverter transação no Unify Bank se existir
    // Buscar bankTransactionId do metadata do ride
    const rideWithMetadata = await runQueryWithTenant<{ metadata?: any }>(tenantId, {
      text: `
        SELECT metadata
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
      values: [tenantId, rideId],
    });

    let bankTransactionId: string | undefined;
    if (rideWithMetadata?.metadata && typeof rideWithMetadata.metadata === 'object') {
      bankTransactionId = rideWithMetadata.metadata.bankTransactionId;
    }

    // Reverter transação se existir (corrida já foi paga)
    if (bankTransactionId) {
      try {
        await bankIntegrationService.reverseTransaction(tenantId, bankTransactionId);
      } catch (error) {
        // Log mas não falha cancelamento se reversão falhar
        console.error('Erro ao reverter transação no Unify Bank ao cancelar ride (não crítico):', error);
      }
    }

    const updated = await runQueryWithTenant<RideRow>(tenantId, {
      text: `
        UPDATE rides_rides
        SET status = 'cancelled',
            cancel_reason = $3,
            cancelled_by = $4,
            cancelledAt = now(),
            updatedAt = now()
        WHERE tenant_id = $1 AND ride_id = $2
        RETURNING *
      `,
      values: [tenantId, rideId, reason, cancelledBy],
    });

    if (!updated) {
      throw new Error('Failed to cancel ride');
    }

    await eventBus.emit({
      type: 'rides.ride.cancelled',
      tenantId,
      payload: {
        rideId,
        reason,
        cancelledBy,
        bankTransactionReversed: !!bankTransactionId,
      },
    });

    return updated;
  }

  // ============================================================================================
  // 🔹 6. Registrar parada completada
  // ============================================================================================
  async completeStop(tenantId: string, rideId: string, stopOrder: number) {
    const updated = await runQueryWithTenant<RideStopRow>(tenantId, {
      text: `
        UPDATE rides_ride_stops
        SET status = 'completed',
            completedAt = now(),
            updatedAt = now()
        WHERE tenant_id = $1 AND ride_id = $2 AND stop_order = $3
        RETURNING *
      `,
      values: [tenantId, rideId, stopOrder],
    });

    if (!updated) {
      throw new Error('Failed to complete stop');
    }

    return updated;
  }

  // ============================================================================================
  // 🔹 7. Tracking GPS da corrida
  // ============================================================================================
  async addRideLocation(tenantId: string, rideId: string, lat: number, lng: number) {
    await runQueryWithTenant(tenantId, {
      text: `
        INSERT INTO rides_ride_locations (
          tenant_id, ride_id, location, createdAt
        )
        VALUES (
          $1, $2,
          ST_SetSRID(ST_MakePoint($4, $3), 4326),
          now()
        )
      `,
      values: [tenantId, rideId, lat, lng],
    });
  }

  // ============================================================================================
  // 🔹 8. Reviews pós corrida
  // ============================================================================================
  async reviewDriver(tenantId: string, rideId: string, passengerId: string, rating: number) {
    const ride = await this.getRide(tenantId, rideId);

    await reviewService.createReview(tenantId, passengerId, 'rides', {
      entityType: 'driver',
      entityId: ride.driver_id,
      rating,
      context: { rideId },
    });

    return { ok: true };
  }

  async reviewPassenger(tenantId: string, rideId: string, driverId: string, rating: number) {
    const ride = await this.getRide(tenantId, rideId);

    await reviewService.createReview(tenantId, driverId, 'rides', {
      entityType: 'passenger',
      entityId: ride.passenger_user_id,
      rating,
      context: { rideId },
    });

    return { ok: true };
  }

  // ============================================================================================
  // 🔹 Utilitário: buscar corrida
  // ============================================================================================
  async getRide(tenantId: string, rideId: string) {
    const ride = await runQueryWithTenant<RideRow>(tenantId, {
      text: `
        SELECT *
        FROM rides_rides
        WHERE tenant_id = $1 AND ride_id = $2
      `,
      values: [tenantId, rideId],
    });

    if (!ride) throw new NotFoundError('Corrida não encontrada.');
    return ride;
  }
}

export const ridesService = new RidesService();

