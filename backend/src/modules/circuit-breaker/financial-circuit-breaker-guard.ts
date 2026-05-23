// Financial Circuit Breaker Guard — bloqueia operações quando breaker está ativo.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { isBreakerActive } from './financial-circuit-breaker-repository';
import type { BreakerType } from './financial-circuit-breaker-repository';

export class FinancialCircuitBreakerError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly breakerType: BreakerType
  ) {
    super(`FINANCIAL_CIRCUIT_BREAKER: ${breakerType} paused for tenant ${tenantId}`);
    this.name = 'FinancialCircuitBreakerError';
  }
}

/**
 * Verifica se o circuit breaker está ativo para o tenant e tipo.
 * Se estiver ativo, lança FinancialCircuitBreakerError.
 */
export async function checkCircuitBreaker(
  tenantId: string,
  breakerType: BreakerType
): Promise<void> {
  const active = await isBreakerActive(tenantId, breakerType);
  if (active) {
    throw new FinancialCircuitBreakerError(tenantId, breakerType);
  }
}