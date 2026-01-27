// src/core/policy-resolution/policy-resolution.types.ts
// Tipos para resolução dinâmica de políticas

/**
 * Módulos do sistema
 */
export type PolicyModule = 'work' | 'rides' | 'events' | 'commerce' | 'other';

/**
 * Contexto para resolução de políticas
 */
export interface PolicyContext {
  cityId?: string; // ID da cidade (para políticas de economia)
  regionId?: string;
  module?: PolicyModule;
  demandIndex?: number; // Índice de demanda (0-1 ou escala livre)
  supplyIndex?: number; // Índice de oferta (0-1 ou escala livre)
  growthRate?: number; // Taxa de crescimento (percentual)
  metadata?: Record<string, unknown>; // Contexto adicional
}

/**
 * Resultado da resolução de uma política
 */
export interface PolicyResolution {
  originalValue: number;
  resolvedValue: number;
  adjustments: Array<{
    reason: string;
    adjustment: number;
  }>;
  context: PolicyContext;
}


