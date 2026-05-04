// backend/src/modules/marketplace/application/handlers/economic-dispatch-accepted.handler.ts

import type { DispatchAcceptedEvent } from '../../domain/dispatch/events/dispatch-accepted.event';

export class EconomicDispatchAcceptedHandler {
  handle(event: DispatchAcceptedEvent) {
    console.log('[EconomicDispatchAcceptedHandler]', event);
  }
}