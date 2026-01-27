// backend/src/core/events/operational-commitments.aggregate.ts
// Aggregate para OperationalCommitment (FASE 4: sem economia)
// EVENT_DOMAIN_MINIMUM_CONTRACT

/**
 * 🔴 ANTI-RESPONSABILIDADES DO OPERATIONALCOMMITMENT
 * 
 * OperationalCommitment NUNCA PODE:
 * - ❌ Executar pagamentos ou custódia
 * - ❌ Aplicar penalidades ou reputação
 * - ❌ Criar ou escrever na Agenda Universal
 * - ❌ Decidir mérito ou disputas
 * - ❌ Inferir status automaticamente
 * - ❌ Aplicar regras por tipo de evento
 * 
 * É factual: registra fatos (check-in/check-out) sem decisões.
 */

import type { OperationalCommitmentStatus } from './operational-commitments.types';

/**
 * Mapa de transições permitidas (puro e determinístico)
 * 
 * Transições válidas:
 * - expected -> checked_in | failed
 * - checked_in -> checked_out | failed
 * - checked_out -> (nenhuma, terminal)
 * - failed -> (nenhuma, terminal)
 * 
 * Sem inferência:
 * - "no-show" só vira failed por comando explícito (markFailed)
 * - Não há cron automático nesta fase
 */
const ALLOWED_TRANSITIONS: Record<OperationalCommitmentStatus, OperationalCommitmentStatus[]> = {
  expected: ['checked_in', 'failed'],
  checked_in: ['checked_out', 'failed'],
  checked_out: [], // Terminal
  failed: [], // Terminal
};

/**
 * Verifica se uma transição de status é permitida
 */
export function canTransition(from: OperationalCommitmentStatus, to: OperationalCommitmentStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Valida e lança erro se transição não for permitida
 */
export function assertTransitionAllowed(
  from: OperationalCommitmentStatus,
  to: OperationalCommitmentStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Transição de status inválida: '${from}' -> '${to}'. ` +
      `Transições permitidas de '${from}': ${ALLOWED_TRANSITIONS[from]?.join(', ') || 'nenhuma'}`
    );
  }
}

/**
 * Valida se um status é terminal (não pode transicionar)
 */
export function isTerminalStatus(status: OperationalCommitmentStatus): boolean {
  return status === 'checked_out' || status === 'failed';
}

