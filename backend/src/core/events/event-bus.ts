import { v4 as uuidv4 } from 'uuid';
import { runQueriesWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { upsertHandlerFailure } from './event-handler-failure.repository';

// ⚠️ NÃO IMPORTAR HANDLERS AQUI - isso causa circular import + TDZ
// Handlers são registrados em register-handlers.ts e chamados no bootstrap

export type EventPayload = Record<string, unknown>;

export interface UnificardEvent<
  TType extends string = string,
  TPayload = EventPayload
> {
  eventId: string;
  tenantId: string;
  type: TType;
  version: number;
  payload: TPayload;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type DomainEvent<TPayload = EventPayload, TType extends string = string> =
  UnificardEvent<TType, TPayload>;

type EventHandler = (event: UnificardEvent) => Promise<void> | void;

type HandlerEntry = { handlerKey: string; handler: EventHandler };

/**
 * EventBus simples e robusto:
 * - Persistência antes dos handlers (garante idempotência real)
 * - Handlers com handler_key estável (retry por chave, nunca republicar o evento inteiro)
 */
export class EventBus {
  private handlersByType = new Map<string, HandlerEntry[]>();
  private registryByKey = new Map<string, { eventType: string; handler: EventHandler }>();

  /**
   * Regista handler com chave globalmente única (obrigatória para rastreio e retry).
   */
  registerHandler(eventType: string, handlerKey: string, handler: EventHandler): void {
    if (this.registryByKey.has(handlerKey)) {
      throw new Error(`Duplicate handler_key: ${handlerKey}`);
    }
    this.registryByKey.set(handlerKey, { eventType, handler });
    const list = this.handlersByType.get(eventType) ?? [];
    list.push({ handlerKey, handler });
    this.handlersByType.set(eventType, list);
  }

  subscribe(eventType: string, handlerKey: string, handler: EventHandler): void {
    this.registerHandler(eventType, handlerKey, handler);
  }

  /**
   * Apenas para worker de retry: invoca um único handler. NUNCA chama publish.
   */
  async invokeHandlerOnly(handlerKey: string, event: UnificardEvent): Promise<void> {
    const reg = this.registryByKey.get(handlerKey);
    if (!reg) {
      throw new Error(`Unknown handler_key: ${handlerKey}`);
    }
    if (reg.eventType !== event.type) {
      throw new Error(
        `handler_key/event_type mismatch: ${handlerKey} expects ${reg.eventType}, got ${event.type}`
      );
    }
    await reg.handler(event);
  }

  /**
   * Publica um evento:
   * 1. Valida tenantId (fail-fast)
   * 2. Persiste no event_log (idempotência via conflict)
   * 3. Executa handlers registrados (cada um isolado; falha → event_handler_failures)
   */
  async publish(
    event: Omit<UnificardEvent, 'eventId' | 'createdAt' | 'version'> & {
      eventId?: string;
      version?: number;
    }
  ): Promise<void> {
    if (!event.tenantId || typeof event.tenantId !== 'string' || event.tenantId.trim() === '') {
      const error = new Error(
        `EVENT_CONTEXT_SAFETY_VIOLATION: tenantId is required and must be a non-empty string. ` +
          `Event type: ${event.type}, EventId: ${event.eventId || 'N/A'}`
      ) as Error & { statusCode?: number };
      error.statusCode = 400;
      canonicalLogger.error(null, 'Evento rejeitado: tenantId ausente ou inválido', {
        eventType: event.type,
        eventId: event.eventId,
        tenantId: event.tenantId,
      });
      throw error;
    }

    const fullEvent: UnificardEvent = {
      ...event,
      eventId: event.eventId ?? uuidv4(),
      createdAt: new Date(),
      version: event.version ?? 1,
    };

    canonicalLogger.info(null, 'Publicando evento', {
      eventType: fullEvent.type,
      eventId: fullEvent.eventId,
      tenantId: fullEvent.tenantId,
    });

    let shouldRunHandlers = true;
    try {
      const inserted = await runQueriesWithTenant<{ event_id: string }>(
        fullEvent.tenantId,
        `
        INSERT INTO event_log (event_id, tenant_id, event_type, event_version, payload, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `,
        [
          fullEvent.eventId,
          fullEvent.tenantId,
          fullEvent.type,
          fullEvent.version,
          fullEvent.payload,
          fullEvent.metadata ?? {},
        ]
      );
      shouldRunHandlers = inserted.length > 0;
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === '42P01') {
        canonicalLogger.warn(null, 'event_log ausente — evento não persistido (dev / perfil CORE_ONLY)', {
          eventType: fullEvent.type,
          eventId: fullEvent.eventId,
        });
        shouldRunHandlers = true;
      } else {
        throw err;
      }
    }

    if (!shouldRunHandlers) {
      canonicalLogger.info(null, 'Evento idempotente — handlers ignorados (event_log já existia)', {
        eventType: fullEvent.type,
        eventId: fullEvent.eventId,
      });
      return;
    }

    const handlers = this.handlersByType.get(fullEvent.type) ?? [];

    for (const { handlerKey, handler } of handlers) {
      try {
        await handler(fullEvent);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        canonicalLogger.error(null, `Handler error for "${fullEvent.type}"`, {
          eventId: fullEvent.eventId,
          tenantId: fullEvent.tenantId,
          handlerKey,
          error: errMsg,
          timestamp: new Date().toISOString(),
        });
        try {
          const recorded = await upsertHandlerFailure({
            tenantId: fullEvent.tenantId,
            eventId: fullEvent.eventId,
            eventType: fullEvent.type,
            handlerKey,
            errorMessage: errMsg,
          });
          if (recorded) {
            canonicalLogger.error(null, 'handler_failure_created', {
              metric_event: 'handler_failure_created',
              tenantId: fullEvent.tenantId,
              eventId: fullEvent.eventId,
              eventType: fullEvent.type,
              handlerKey,
              attempts: recorded.attempts,
              handlerFailureStatus: recorded.status,
            });
          }
        } catch (persistErr) {
          canonicalLogger.error(null, 'Falha ao persistir event_handler_failures', {
            handlerKey,
            eventId: fullEvent.eventId,
            error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          });
        }
      }
    }
  }

  async emit(
    event: Omit<UnificardEvent, 'eventId' | 'createdAt' | 'version'> & {
      eventId?: string;
      version?: number;
    }
  ): Promise<void> {
    return this.publish(event);
  }
}

export const eventBus = new EventBus();
