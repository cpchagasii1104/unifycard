// Registo dos handlers de dispatch aceito no eventBus canónico (@core/events/event-bus).
// Entrega exclusiva: outbox → worker → publish canónico → estes handlers (idempotência via event_log).

import type { EventBus, DomainEvent } from '@core/events/event-bus';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { DispatchAcceptedEvent } from '../../domain/dispatch/events/dispatch-accepted.event';
import { OrdersDispatchAcceptedHandler } from './orders-dispatch-accepted.handler';
import { CapacityDispatchAcceptedHandler } from './capacity-dispatch-accepted.handler';
import { EconomicDispatchAcceptedHandler } from './economic-dispatch-accepted.handler';

function toDispatchAcceptedDomainEvent(event: DomainEvent): DispatchAcceptedEvent | null {
  const p = event.payload;
  const dispatchId = p.dispatchId;
  const providerActorId = p.providerActorId;
  const orderId = p.orderId;
  if (
    typeof dispatchId !== 'string' ||
    typeof providerActorId !== 'string' ||
    typeof orderId !== 'string' ||
    !dispatchId ||
    !providerActorId ||
    !orderId
  ) {
    canonicalLogger.warn(null, 'DispatchAccepted: payload em falta ou inválido', {
      eventId: event.eventId,
      tenantId: event.tenantId,
    });
    return null;
  }
  return new DispatchAcceptedEvent({ dispatchId, providerActorId, orderId });
}

function requireTenant(event: DomainEvent): void {
  if (!event.tenantId || typeof event.tenantId !== 'string' || !event.tenantId.trim()) {
    canonicalLogger.error(null, 'DispatchAccepted rejeitado: tenantId ausente ou inválido', {
      eventId: event.eventId,
      eventType: event.type,
    });
    throw new Error('EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required for DispatchAccepted');
  }
}

/**
 * Três handlers com handler_key distintos: falha e retry por sub-handler (norma HANDLER_EXECUTION_AND_RELIABILITY).
 */
export function registerMarketplaceDispatchAcceptedHandlers(eventBus: EventBus): void {
  const orders = new OrdersDispatchAcceptedHandler();
  const capacity = new CapacityDispatchAcceptedHandler();
  const economic = new EconomicDispatchAcceptedHandler();

  eventBus.registerHandler(DispatchAcceptedEvent.name, 'marketplace.dispatchAccepted.orders', async (event) => {
    requireTenant(event as DomainEvent);
    const domainEvent = toDispatchAcceptedDomainEvent(event as DomainEvent);
    if (!domainEvent) return;
    orders.handle(domainEvent);
  });

  eventBus.registerHandler(DispatchAcceptedEvent.name, 'marketplace.dispatchAccepted.capacity', async (event) => {
    requireTenant(event as DomainEvent);
    const domainEvent = toDispatchAcceptedDomainEvent(event as DomainEvent);
    if (!domainEvent) return;
    capacity.handle(domainEvent);
  });

  eventBus.registerHandler(DispatchAcceptedEvent.name, 'marketplace.dispatchAccepted.economic', async (event) => {
    requireTenant(event as DomainEvent);
    const domainEvent = toDispatchAcceptedDomainEvent(event as DomainEvent);
    if (!domainEvent) return;
    economic.handle(domainEvent);
  });
}