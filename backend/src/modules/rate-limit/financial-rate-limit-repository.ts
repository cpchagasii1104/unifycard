// Financial Rate Limit Repository — tabela financial_rate_limits.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export const ACTION_TYPES = ['payment_attempt', 'payout_request', 'webhook_event'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Janela em ms: payment e webhook = 1 min, payout = 1 hora */
export function getWindowStartMs(actionType: ActionType): number {
  switch (actionType) {
    case 'payment_attempt':
    case 'webhook_event':
      return 60 * 1000;
    case 'payout_request':
      return 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

/** Retorna o início da janela atual (timestamp) para o tipo. */
export function getCurrentWindowStart(actionType: ActionType): Date {
  const now = Date.now();
  const windowMs = getWindowStartMs(actionType);
  const start = new Date(Math.floor(now / windowMs) * windowMs);
  return start;
}

/**
 * Incrementa contador da janela atual. Upsert por (tenant_id, actor_id, action_type, window_start).
 */
export async function recordAction(
  tenantId: string,
  actorId: string,
  actionType: ActionType
): Promise<void> {
  const windowStart = getCurrentWindowStart(actionType);
  await runQueryWithTenant(
    tenantId,
    `INSERT INTO financial_rate_limits (tenant_id, actor_id, action_type, action_count, window_start)
     VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (tenant_id, actor_id, action_type, window_start)
     DO UPDATE SET action_count = financial_rate_limits.action_count + 1`,
    [tenantId, actorId, actionType, windowStart.toISOString()]
  );
}

/**
 * Retorna o action_count da janela indicada (0 se não existir).
 */
export async function getActionCount(
  tenantId: string,
  actorId: string,
  actionType: ActionType,
  windowStart: Date
): Promise<number> {
  const row = await runQueryWithTenant<{ action_count: string }>(
    tenantId,
    `SELECT action_count::text FROM financial_rate_limits
     WHERE tenant_id = $1 AND actor_id = $2 AND action_type = $3 AND window_start = $4`,
    [tenantId, actorId, actionType, windowStart.toISOString()]
  );
  return row ? parseInt(row.action_count, 10) : 0;
}

/**
 * Remove registros do (tenant, actor, action_type) para permitir reset manual.
 */
export async function resetWindow(
  tenantId: string,
  actorId: string,
  actionType: ActionType
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `DELETE FROM financial_rate_limits
     WHERE tenant_id = $1 AND actor_id = $2 AND action_type = $3`,
    [tenantId, actorId, actionType]
  );
}