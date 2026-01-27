// backend/src/core/events/aspects/event-aspects.v1.ts
// Vocabulário fechado e versionado de EventAspect
// EVENT_DOMAIN_MINIMUM_CONTRACT FASE 2

/**
 * 🔴 VOCABULÁRIO FECHADO, VERSIONADO, NÃO RETROATIVO
 * 
 * Regras de governança:
 * - v2 só pode adicionar novos aspectos; nunca renomear/remover
 * - Aspectos não retroagem
 * - Aspectos não executam lógica
 * - Aspectos são apenas vocabulário declarativo
 * 
 * Versionamento:
 * - v1: vocabulário inicial
 * - Futuras versões: apenas adição, nunca remoção/renomeação
 */

export const EVENT_ASPECTS_V1 = [
  'cultural',
  'gastronomico',
  'social',
  'profissional',
  'comunitario',
  'espiritual',
  'esportes',
  'privado',
] as const;

export type EventAspectV1 = typeof EVENT_ASPECTS_V1[number];

export const EVENT_ASPECTS_VERSION = 'v1' as const;

/**
 * Valida se um aspecto é válido no vocabulário v1
 */
export function isValidEventAspectV1(aspect: string): aspect is EventAspectV1 {
  return EVENT_ASPECTS_V1.includes(aspect as EventAspectV1);
}

