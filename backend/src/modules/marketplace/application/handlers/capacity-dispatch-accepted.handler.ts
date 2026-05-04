// backend/src/modules/marketplace/application/handlers/capacity-dispatch-accepted.handler.ts

import type { DispatchAcceptedEvent } from '../../domain/dispatch/events/dispatch-accepted.event';

export class CapacityDispatchAcceptedHandler {
  handle(event: DispatchAcceptedEvent) {
    console.log('[CapacityDispatchAcceptedHandler]', event);
  }
}