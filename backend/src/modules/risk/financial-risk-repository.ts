// Financial Risk Repository — tabela financial_risk_events.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export interface FinancialRiskEvent {
  id: string;
  tenantId: string;
  actorId: string;
  riskType: string;
  riskScore: number;
  referenceId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

interface FinancialRiskEventRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  risk_type: string;
  risk_score: string;
  reference_id: string | null;
  details: Record<string, unknown>;
  created_at: Date;
}

function toEvent(row: FinancialRiskEventRow): FinancialRiskEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    riskType: row.risk_type,
    riskScore: parseInt(String(row.risk_score), 10),
    referenceId: row.reference_id,
    details: row.details || {},
    createdAt: row.created_at.toISOString(),
  };
}

export interface RecordRiskEventInput {
  actorId: string;
  riskType: string;
  riskScore: number;
  referenceId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordRiskEvent(
  tenantId: string,
  input: RecordRiskEventInput
): Promise<FinancialRiskEvent> {
  const row = await runQueryWithTenant<FinancialRiskEventRow>(
    tenantId,
    `INSERT INTO financial_risk_events (tenant_id, actor_id, risk_type, risk_score, reference_id, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, tenant_id, actor_id, risk_type, risk_score, reference_id, details, created_at`,
    [
      tenantId,
      input.actorId,
      input.riskType,
      input.riskScore,
      input.referenceId ?? null,
      JSON.stringify(input.details ?? {}),
    ]
  );
  if (!row) throw new Error('recordRiskEvent: insert failed');
  return toEvent(row);
}

export async function listRiskEvents(actorId: string): Promise<FinancialRiskEvent[]> {
  const result = await pool.query<FinancialRiskEventRow>(
    `SELECT id, tenant_id, actor_id, risk_type, risk_score, reference_id, details, created_at
     FROM financial_risk_events
     WHERE actor_id = $1
     ORDER BY created_at DESC
     LIMIT 500`,
    [actorId]
  );
  return result.rows.map(toEvent);
}

/** Lista atores com pelo menos um evento de risco com score >= 70 nas últimas 24h. */
export async function listHighRiskActors(): Promise<{ tenant_id: string; actor_id: string; max_score: number }[]> {
  const result = await pool.query<{ tenant_id: string; actor_id: string; max_score: string }>(
    `SELECT tenant_id, actor_id, MAX(risk_score)::int as max_score
     FROM financial_risk_events
     WHERE created_at >= now() - interval '24 hours' AND risk_score >= 70
     GROUP BY tenant_id, actor_id`
  );
  return result.rows.map((r) => ({
    tenant_id: r.tenant_id,
    actor_id: r.actor_id,
    max_score: parseInt(r.max_score, 10),
  }));
}