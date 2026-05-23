// Financial Alert Repository — tabela financial_alerts (alertas operacionais).
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type FinancialAlertSeverity = 'info' | 'warning' | 'critical';

export interface FinancialAlert {
  id: string;
  tenantId: string;
  alertType: string;
  referenceId: string;
  severity: FinancialAlertSeverity;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface FinancialAlertRow {
  id: string;
  tenant_id: string;
  alert_type: string;
  reference_id: string;
  severity: string;
  message: string;
  created_at: Date;
  resolved_at: Date | null;
}

function toAlert(row: FinancialAlertRow): FinancialAlert {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    alertType: row.alert_type,
    referenceId: row.reference_id,
    severity: row.severity as FinancialAlertSeverity,
    message: row.message,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}

export interface CreateFinancialAlertInput {
  alertType: string;
  referenceId: string;
  severity: FinancialAlertSeverity;
  message: string;
}

export async function createFinancialAlert(
  tenantId: string,
  input: CreateFinancialAlertInput
): Promise<FinancialAlert> {
  const row = await runQueryWithTenant<FinancialAlertRow>(
    tenantId,
    `INSERT INTO financial_alerts (tenant_id, alert_type, reference_id, severity, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id, alert_type, reference_id, severity, message, created_at, resolved_at`,
    [tenantId, input.alertType, input.referenceId, input.severity, input.message]
  );
  if (!row) throw new Error('createFinancialAlert: insert failed');
  return toAlert(row);
}

/**
 * Lista alertas não resolvidos (resolved_at IS NULL). Opcionalmente por tenant.
 */
export async function listUnresolvedAlerts(tenantId?: string): Promise<FinancialAlert[]> {
  const query =
    tenantId === undefined
      ? `SELECT id, tenant_id, alert_type, reference_id, severity, message, created_at, resolved_at
         FROM financial_alerts WHERE resolved_at IS NULL ORDER BY created_at DESC`
      : `SELECT id, tenant_id, alert_type, reference_id, severity, message, created_at, resolved_at
         FROM financial_alerts WHERE tenant_id = $1 AND resolved_at IS NULL ORDER BY created_at DESC`;
  const result = await pool.query<FinancialAlertRow>(query, tenantId === undefined ? [] : [tenantId]);
  return result.rows.map(toAlert);
}

/**
 * Verifica se já existe alerta não resolvido para (tenant_id, alert_type, reference_id).
 */
export async function hasUnresolvedAlert(
  tenantId: string,
  alertType: string,
  referenceId: string
): Promise<boolean> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM financial_alerts
     WHERE tenant_id = $1 AND alert_type = $2 AND reference_id = $3 AND resolved_at IS NULL`,
    [tenantId, alertType, referenceId]
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

export async function resolveAlert(tenantId: string, alertId: string): Promise<FinancialAlert> {
  const row = await runQueryWithTenant<FinancialAlertRow>(
    tenantId,
    `UPDATE financial_alerts SET resolved_at = now() WHERE tenant_id = $1 AND id = $2
     RETURNING id, tenant_id, alert_type, reference_id, severity, message, created_at, resolved_at`,
    [tenantId, alertId]
  );
  if (!row) throw new Error('resolveAlert: alert not found');
  return toAlert(row);
}