// src/core/simulation/event-source.interface.ts
// Interface para fontes de eventos canônicos

import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';
import type { EventFilters } from './simulation.types';

/**
 * Interface para fontes de eventos canônicos
 * Permite diferentes implementações (event_log, logs, arquivos, etc)
 */
export interface CanonicalEventSource {
  /**
   * Lista eventos canônicos com filtros
   * READ-ONLY - não altera dados
   */
  listEvents(filters: EventFilters): Promise<CanonicalEvent[]>;
}



