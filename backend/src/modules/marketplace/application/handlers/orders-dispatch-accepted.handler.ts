// backend/src/modules/marketplace/application/handlers/orders-dispatch-accepted.handler.ts

import type { DispatchAcceptedEvent } from '../../domain/dispatch/events/dispatch-accepted.event';

export class OrdersDispatchAcceptedHandler {
  handle(event: DispatchAcceptedEvent) {
    console.log('[OrdersDispatchAcceptedHandler]', event);
  }
}