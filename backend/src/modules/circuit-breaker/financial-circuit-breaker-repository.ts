// Financial Circuit Breaker Repository — tabela financial_circuit_breakers.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant } from '@core/database/pool';

export type BreakerType = 'payments' | 'payouts' | 'settlements';
export type BreakerStatus = 'active' | 'released';

export interface FinancialCircuitBreaker {
  id: string;
  tenantId: string;
  breakerType: BreakerType;
  status: BreakerStatus;
  triggerReason: string | null;
  createdAt: string;
  releasedAt: string | null;
}

interface BreakerRow {
  id: string;
  tenant_id: string;
  breaker_type: string;
  status: string;
  trigger_reason: string | null;
  created_at: Date;
  released_at: Date | null;
}

function toBreaker(row: BreakerRow): FinancialCircuitBreaker {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    breakerType: row.breaker_type as BreakerType,
    status: row.status as BreakerStatus,
    triggerReason: row.trigger_reason,
    createdAt: row.created_at.toISOString(),
    releasedAt: row.released_at ? row.released_at.toISOString() : null,
  };
}

export interface ActivateBreakerInput {
  breakerType: BreakerType;
  triggerReason?: string | null;
}

/**
 * Ativa um circuit breaker para o tenant e tipo. Insere registro com status 'active'.
 */
export async function activateBreaker(
  tenantId: string,
  input: ActivateBreakerInput
): Promise<FinancialCircuitBreaker> {
  const row = await runQueryWithTenant<BreakerRow>(
    tenantId,
    `INSERT INTO financial_circuit_breakers (tenant_id, breaker_type, status, trigger_reason)
     VALUES ($1, $2, 'active', $3)
     RETURNING id, tenant_id, breaker_type, status, trigger_reason, created_at, released_at`,
    [tenantId, input.breakerType, input.triggerReason ?? null]
  );
  if (!row) throw new Error('activateBreaker: insert failed');
  return toBreaker(row);
}

/**
 * Libera o circuit breaker ativo para o tenant e tipo.
 */
export async function releaseBreaker(
  tenantId: string,
  breakerType: BreakerType
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `UPDATE financial_circuit_breakers
     SET status = 'released', released_at = now()
     WHERE tenant_id = $1 AND breaker_type = $2 AND status = 'active'`,
    [tenantId, breakerType]
  );
}

/**
 * Retorna true se existir breaker ativo para o tenant e tipo.
 *
 * DT-CIRCUIT-BREAKER-RAW-POOL-QUERY-FAIL-OPEN-UNDER-RLS (achado A3, 2026-07-02; corrigido
 * 2026-07-05): usava `pool.query` cru sem tenant-context. `financial_circuit_breakers` tem
 * RLS+FORCE desde 20260702160000 — sob role restrito, a leitura sempre retornaria 0 linhas,
 * fazendo o caller interpretar "sem breaker ativo" mesmo com um ativo (fail-open, direção
 * perigosa: pagamentos/payouts não pausariam quando deveriam). Corrigido pra `runQueryWithTenant`,
 * mesmo padrão de `activateBreaker`/`releaseBreaker` neste arquivo.
 */
export async function isBreakerActive(
  tenantId: string,
  breakerType: BreakerType
): Promise<boolean> {
  const row = await runQueryWithTenant<{ n: number }>(
    tenantId,
    `SELECT 1 as n FROM financial_circuit_breakers
     WHERE tenant_id = $1 AND breaker_type = $2 AND status = 'active'
     LIMIT 1`,
    [tenantId, breakerType]
  );
  return row != null;
}