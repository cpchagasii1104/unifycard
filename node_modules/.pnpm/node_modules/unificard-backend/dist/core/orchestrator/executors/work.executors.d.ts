import type { UnificardEvent } from '@core/events/event-bus';
/**
 * Handler para evento: work.job.created
 * Salva contexto no Memory Engine
 */
export declare function onJobCreated(event: UnificardEvent): Promise<void>;
/**
 * Handler para evento: work.assignment.completed
 * - Salva contexto no Memory Engine
 * - Gera resumo da sessão via AI Kernel
 */
export declare function onAssignmentCompleted(event: UnificardEvent): Promise<void>;
//# sourceMappingURL=work.executors.d.ts.map