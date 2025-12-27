import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant } from '@core/database/pool';

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

/**
 * EventBus simples e robusto:
 * - Persistência antes dos handlers (garante idempotência real)
 * - Handlers registrados em memória para alto desempenho
 * - Módulos transversais plugam handlers de forma centralizada
 */
export class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  /**
   * Registra um handler para um tipo de evento específico
   */
  registerHandler(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  subscribe(eventType: string, handler: EventHandler): void {
    this.registerHandler(eventType, handler);
  }

  /**
   * Publica um evento:
   * 1. Persiste no event_log (idempotência via conflict)
   * 2. Executa handlers registrados
   */
  async publish(
    event: Omit<UnificardEvent, 'eventId' | 'createdAt' | 'version'> & {
      eventId?: string;
      version?: number;
    }
  ): Promise<void> {
    const fullEvent: UnificardEvent = {
      ...event,
      eventId: event.eventId ?? uuidv4(),
      createdAt: new Date(),
      version: event.version ?? 1,
    };

    // ============================================================
    // 1) Persistência antes do processamento (garante idempotência)
    // ============================================================
    await runQueryWithTenant(
      fullEvent.tenantId,
      `
        INSERT INTO event_log (event_id, tenant_id, event_type, event_version, payload, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (event_id) DO NOTHING
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

    // ============================================================
    // 2) Executar handlers registrados
    // ============================================================
    const handlers = this.handlers.get(fullEvent.type) ?? [];

    for (const handler of handlers) {
      try {
        await handler(fullEvent);
      } catch (error) {
        console.error(
          `[EventBus] Handler error for "${fullEvent.type}"`,
          error
        );
      }
    }
  }

  /**
   * Alias semântico para publish — mantém compatibilidade
   * com chamadas antigas que usam `eventBus.emit(...)`.
   */
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

// ⚠️ REGISTRO DE HANDLERS FOI MOVIDO PARA register-handlers.ts
// Isso evita circular imports e problemas de TDZ (Temporal Dead Zone)
// Os handlers são registrados no bootstrap (server.ts) DEPOIS de tudo estar inicializado
