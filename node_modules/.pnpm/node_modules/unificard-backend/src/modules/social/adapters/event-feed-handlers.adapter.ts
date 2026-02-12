// src/modules/social/adapters/event-feed-handlers.adapter.ts
/**
 * Adapter: Event Feed Handlers
 * 
 * Implementa interface do core usando handlers reais do module.
 */

import type { EventFeedHandlersPort } from '@core/social/ports';
import { registerEventFeedHandlers as realRegisterEventFeedHandlers } from '../event-feed.handlers';

export class EventFeedHandlersAdapter implements EventFeedHandlersPort {
  registerEventFeedHandlers(): void {
    realRegisterEventFeedHandlers();
  }
}

export const eventFeedHandlersAdapter = new EventFeedHandlersAdapter();





