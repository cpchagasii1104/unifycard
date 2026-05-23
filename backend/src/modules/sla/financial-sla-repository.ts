// Financial SLA Repository — tabela financial_sla_events (atrasos operacionais).
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export interface FinancialSlaEvent {
  id: string;
  tenantId: string;
  slaType: string;
  referenceId: string;
  expectedAt: string;
  actualAt: string;
  delaySeconds: number;
  createdAt: string;
}

interface FinancialSlaEventRow {
  id: string;
  tenant_id: string;
  sla_type: string;
  reference_id: string;
  expected_at: Date;
  actual_at: Date;
  delay_seconds: string;
  created_at: Date;
}

function toEvent(row: FinancialSlaEventRow): FinancialSlaEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slaType: row.sla_type,
    referenceId: row.reference_id,
    expectedAt: row.expected_at.toISOString(),
    actualAt: row.actual_at.toISOString(),
    delaySeconds: parseInt(String(row.delay_seconds), 10),
    createdAt: row.created_at.toISOString(),
  };
}

export interface RecordSlaEventInput {
  slaType: string;
  referenceId: string;
  expectedAt: Date;
  actualAt: Date;
  delaySeconds: number;
}

/**
 * Registra um evento de breach de SLA.
 */
export async function recordSlaEvent(
  tenantId: string,
  input: RecordSlaEventInput
): Promise<FinancialSlaEvent> {
  const row = await runQueryWithTenant<FinancialSlaEventRow>(
    tenantId,
    `INSERT INTO financial_sla_events (tenant_id, sla_type, reference_id, expected_at, actual_at, delay_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tenant_id, sla_type, reference_id, expected_at, actual_at, delay_seconds, created_at`,
    [
      tenantId,
      input.slaType,
      input.referenceId,
      input.expectedAt,
      input.actualAt,
      input.delaySeconds,
    ]
  );
  if (!row) throw new Error('recordSlaEvent: insert failed');
  return toEvent(row);
}

/**
 * Lista breaches de SLA (eventos recentes). Opcionalmente por tenant e tipo.
 */
export async function listSlaBreaches(
  options?: { tenantId?: string; slaType?: string; limit?: number }
): Promise<FinancialSlaEvent[]> {
  const limit = options?.limit ?? 500;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (options?.tenantId) {
    conditions.push(`tenant_id = $${idx++}`);
    values.push(options.tenantId);
  }
  if (options?.slaType) {
    conditions.push(`sla_type = $${idx++}`);
    values.push(options.slaType);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);
  const result = await pool.query<FinancialSlaEventRow>(
    `SELECT id, tenant_id, sla_type, reference_id, expected_at, actual_at, delay_seconds, created_at
     FROM financial_sla_events
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx}`,
    values
  );
  return result.rows.map(toEvent);
}