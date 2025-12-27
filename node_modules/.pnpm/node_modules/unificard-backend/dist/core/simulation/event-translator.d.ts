import type { UnificardEvent } from '../events/event-bus';
import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';
/**
 * Traduz evento do event_log para formato canônico
 */
export declare function translateEventToCanonical(event: UnificardEvent): CanonicalEvent | null;
//# sourceMappingURL=event-translator.d.ts.map