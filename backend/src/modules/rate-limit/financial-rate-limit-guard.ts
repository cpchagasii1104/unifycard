// Financial Rate Limit Guard — proteção contra abuso. Não altera bank_transactions, bank_ledger nem bank_accounts.

import type { ActionType } from './financial-rate-limit-repository';
import {
  getCurrentWindowStart,
  getActionCount,
  recordAction,
} from './financial-rate-limit-repository';

const LIMITS: Record<ActionType, number> = {
  payment_attempt: 100,   // por minuto
  payout_request: 10,     // por hora
  webhook_event: 500,     // por minuto
};

export class FinancialRateLimitError extends Error {
  constructor(
    public readonly actionType: ActionType,
    public readonly limit: number,
    public readonly window: string
  ) {
    super(`RATE_LIMIT_EXCEEDED: ${actionType} (limit ${limit} per window)`);
    this.name = 'FinancialRateLimitError';
  }
}

/**
 * Verifica o rate limit e registra a ação se dentro do limite. Lança FinancialRateLimitError se exceder.
 */
export async function checkRateLimit(
  tenantId: string,
  actorId: string,
  actionType: ActionType
): Promise<void> {
  const windowStart = getCurrentWindowStart(actionType);
  const count = await getActionCount(tenantId, actorId, actionType, windowStart);
  const limit = LIMITS[actionType];
  if (count >= limit) {
    throw new FinancialRateLimitError(actionType, limit, windowStart.toISOString());
  }
  await recordAction(tenantId, actorId, actionType);
}