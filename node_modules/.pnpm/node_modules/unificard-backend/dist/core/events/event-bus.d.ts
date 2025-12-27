export type EventPayload = Record<string, unknown>;
export interface UnificardEvent<TType extends string = string, TPayload = EventPayload> {
    eventId: string;
    tenantId: string;
    type: TType;
    version: number;
    payload: TPayload;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}
export type DomainEvent<TPayload = EventPayload, TType extends string = string> = UnificardEvent<TType, TPayload>;
type EventHandler = (event: UnificardEvent) => Promise<void> | void;
/**
 * EventBus simples e robusto:
 * - Persistência antes dos handlers (garante idempotência real)
 * - Handlers registrados em memória para alto desempenho
 * - Módulos transversais plugam handlers de forma centralizada
 */
export declare class EventBus {
    private handlers;
    /**
     * Registra um handler para um tipo de evento específico
     */
    registerHandler(eventType: string, handler: EventHandler): void;
    subscribe(eventType: string, handler: EventHandler): void;
    /**
     * Publica um evento:
     * 1. Persiste no event_log (idempotência via conflict)
     * 2. Executa handlers registrados
     */
    publish(event: Omit<UnificardEvent, 'eventId' | 'createdAt' | 'version'> & {
        eventId?: string;
        version?: number;
    }): Promise<void>;
    /**
     * Alias semântico para publish — mantém compatibilidade
     * com chamadas antigas que usam `eventBus.emit(...)`.
     */
    emit(event: Omit<UnificardEvent, 'eventId' | 'createdAt' | 'version'> & {
        eventId?: string;
        version?: number;
    }): Promise<void>;
}
export declare const eventBus: EventBus;
export {};
//# sourceMappingURL=event-bus.d.ts.map