// backend/src/modules/marketplace/core/event-bus.ts
// Internal domain event bus: prevents "God Facade Drift" by letting domains react to events
// instead of the facade orchestrating multiple domains.
//
// Rule: If a method needs to call more than 2 different domains, emit a domain event
// instead of orchestrating directly.

import { incrementEvent } from './event-metrics';
import { recordEvent } from './event-timeline';

export interface DomainEvent<T = unknown> {
  type: string;
  payload: T;
  occurredAt: Date;
}

export type DomainEventHandler<T = unknown> = (event: DomainEvent<T>) => void;

interface HandlerEntry {
  handler: DomainEventHandler;
  name?: string;
}

export interface EventBusLogger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, err?: unknown): void;
}

export class EventBus {
  private readonly handlers = new Map<string, HandlerEntry[]>();
  private logger?: EventBusLogger;

  constructor(options?: { logger?: EventBusLogger }) {
    this.logger = options?.logger;
  }

  setLogger(logger: EventBusLogger): void {
    this.logger = logger;
  }

  /**
   * Subscribe a handler for an event type. Optional handlerName improves observability (logging/tracing).
   */
  subscribe<T = unknown>(eventType: string, handler: DomainEventHandler<T>, handlerName?: string): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push({ handler: handler as DomainEventHandler, name: handlerName });
    this.handlers.set(eventType, list);
    this.logger?.debug?.('EventBus.subscribe', {
      eventType,
      handler: handlerName,
      totalHandlers: list.length,
    });
  }

  /**
   * Publish a domain event to all subscribers.
   */
  publish<T = unknown>(event: DomainEvent<T>): void {
    const { type } = event;
    incrementEvent(type);
    recordEvent(event);
    this.logger?.debug?.('DomainEvent published', {
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
    });
    const list = this.handlers.get(type) ?? [];
    for (const entry of list) {
      const handlerName = entry.name;
      this.logger?.debug?.('DomainEvent handler executing', {
        eventType: type,
        handler: handlerName,
      });
      try {
        entry.handler(event);
        this.logger?.debug?.('DomainEvent handler executed', {
          eventType: type,
          handler: handlerName,
        });
      } catch (err) {
        this.logger?.error?.('DomainEvent handler failed', {
          eventType: type,
          handler: handlerName,
          error: err,
        });
        // Isolamento: um handler que falha não bloqueia os demais; o loop continua.
      }
    }
  }
}

let instance: EventBus | null = null;

/**
 * Singleton domain event bus for the marketplace module.
 */
export function getDomainEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}

export const domainEventBus = getDomainEventBus();