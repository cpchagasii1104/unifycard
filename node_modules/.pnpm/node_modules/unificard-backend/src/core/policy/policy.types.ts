// src/core/policy/policy.types.ts
// Tipos para políticas declarativas

/**
 * Domínios de políticas
 */
export type PolicyDomain = 'economy' | 'work' | 'rides' | 'fund' | 'simulation' | 'risk' | 'marketplace' | 'category' | 'loyalty' | 'presence' | 'live_chat';

/**
 * Valores possíveis de uma política
 */
export type PolicyValue = number | boolean | string;

/**
 * Interface de uma política declarativa
 */
export interface Policy {
  id: string;
  domain: PolicyDomain;
  key: string;
  valueCents: PolicyValue;
  effectiveFrom: string; // ISO date string
  metadata?: Record<string, unknown>;
}












