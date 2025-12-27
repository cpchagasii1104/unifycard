// backend/src/core/notify/handlers/rides-notify.handlers.ts

/**
 * Handlers de notificação do módulo RIDES.
 *
 * Eventos escutados (sugeridos):
 * - rides.ride_request.created
 * - rides.ride.driver_assigned
 * - rides.ride.driver_arrived
 * - rides.ride.started
 * - rides.ride.completed
 * - rides.ride.cancelled
 * - rides.driver.forced_break
 * - rides.zone.high_demand
 */

import type { EventBus, UnificardEvent } from '@core/events/event-bus';
import { notifyService } from '@core/notify/notify.service';

export function registerRidesNotifyHandlers(eventBus: EventBus) {
  const toString = (value: unknown) => String(value ?? '');

  // Quando uma nova solicitação de corrida é criada
  eventBus.subscribe(
    'rides.ride_request.created',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const passengerId = toString(payload.passengerId);
      if (!passengerId) return;

      await notifyService.send({
        tenantId,
        userId: passengerId,
        channel: 'push',
        templateName: null,
        target: passengerId,
        payload: {
          title: 'Corrida solicitada',
          body: 'Estamos buscando um motorista para você.',
          requestId: payload.requestId,
        },
      });
    }
  );

  // Motorista atribuído à corrida
  eventBus.subscribe(
    'rides.ride.driver_assigned',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const passengerId = toString(payload.passengerId);
      if (!passengerId) return;

      await notifyService.send({
        tenantId,
        userId: passengerId,
        channel: 'push',
        templateName: null,
        target: passengerId,
        payload: {
          title: 'Motorista a caminho',
          body: `Seu motorista ${payload.driverName} está a caminho.`,
          rideId: payload.rideId,
          driverId: payload.driverId,
        },
      });
    }
  );

  // Corrida iniciada
  eventBus.subscribe(
    'rides.ride.started',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const passengerId = toString(payload.passengerId);
      if (!passengerId) return;

      await notifyService.send({
        tenantId,
        userId: passengerId,
        channel: 'push',
        templateName: null,
        target: passengerId,
        payload: {
          title: 'Corrida iniciada',
          body: 'Sua corrida começou.',
          rideId: payload.rideId,
        },
      });
    }
  );

  // Corrida concluída
  eventBus.subscribe(
    'rides.ride.completed',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const passengerId = toString(payload.passengerId);
      if (!passengerId) return;
      const finalPrice = payload.finalPrice as number | string | undefined;
      const finalPriceText =
        typeof finalPrice === 'number'
          ? finalPrice.toFixed(2)
          : finalPrice ?? '';

      await notifyService.send({
        tenantId,
        userId: passengerId,
        channel: 'push',
        templateName: null,
        target: passengerId,
        payload: {
          title: 'Corrida finalizada',
          body: `Valor final: R$ ${finalPriceText}`,
          rideId: payload.rideId,
        },
      });
    }
  );

  // Corrida cancelada
  eventBus.subscribe(
    'rides.ride.cancelled',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const passengerId = toString(payload.passengerId);
      if (!passengerId) return;

      await notifyService.send({
        tenantId,
        userId: passengerId,
        channel: 'push',
        templateName: null,
        target: passengerId,
        payload: {
          title: 'Corrida cancelada',
          body: 'Sua corrida foi cancelada.',
          rideId: payload.rideId,
          cancelledBy: payload.cancelledBy,
        },
      });
    }
  );

  // Motorista entrou em pausa forçada (limite 12h)
  eventBus.subscribe(
    'rides.driver.forced_break',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const driverId = toString(payload.driverId);
      if (!driverId) return;

      await notifyService.send({
        tenantId,
        userId: driverId,
        channel: 'push',
        templateName: null,
        target: driverId,
        payload: {
          title: 'Pausa obrigatória',
          body: 'Você atingiu o limite de horas dirigindo. Faça uma pausa antes de voltar.',
          forcedBreakUntil: payload.forcedBreakUntil,
        },
      });
    }
  );

  // Zona com alta demanda
  eventBus.subscribe(
    'rides.zone.high_demand',
    async (event: UnificardEvent) => {
      const { tenantId } = event;
      const payload = event.payload as Record<string, any>;
      const zoneId = toString(payload.zoneId);
      if (!zoneId) return;

      await notifyService.send({
        tenantId,
        userId: null,
        channel: 'push',
        templateName: null,
        target: zoneId,
        payload: {
          title: 'Zona com alta demanda',
          body: 'Há poucas corridas disponíveis nesta região. Considere se mover para lá.',
          zoneId: payload.zoneId,
        },
      });
    }
  );
}
