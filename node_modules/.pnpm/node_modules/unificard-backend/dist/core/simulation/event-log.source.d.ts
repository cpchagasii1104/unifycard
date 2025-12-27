import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';
import type { CanonicalEventSource } from './event-source.interface';
import type { EventFilters } from './simulation.types';
/**
 * Implementação que lê eventos do event_log e converte para CanonicalEvent
 */
declare class EventLogSource implements CanonicalEventSource {
    /**
     * Lista eventos canônicos do event_log
     */
    listEvents(filters: EventFilters): Promise<CanonicalEvent[]>;
}
export declare const eventLogSource: EventLogSource;
export {};
//# sourceMappingURL=event-log.source.d.ts.map