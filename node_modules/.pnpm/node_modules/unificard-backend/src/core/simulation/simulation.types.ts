// src/core/simulation/simulation.types.ts
// Tipos para simulação econômica

import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';

/**
 * Filtros para buscar eventos
 */
export interface EventFilters {
  tenantId?: string;
  sourceModule?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  regionId?: string;
  userId?: string;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Regras de simulação
 */
export interface SimulationRules {
  // Split regional alternativo (ex: 0.15 para 15%)
  regionalSplitPercentage?: number;
  // Outras regras futuras podem ser adicionadas aqui
  [key: string]: unknown;
}

/**
 * Resultado de uma simulação
 */
export interface SimulationResult {
  simulationId: string;
  simulationType: string;
  rules: SimulationRules;
  actualValue: number;
  simulatedValue: number;
  delta: number;
  percentageChange: number;
  eventCount: number;
  period: {
    start: string;
    end: string;
  };
  metadata?: Record<string, unknown>;
}



