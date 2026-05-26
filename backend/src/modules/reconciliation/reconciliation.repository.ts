/**
 * Prompt 52 — Reconciliation Engine: runs + ledger discrepancies (tabelas reconciliation_runs / reconciliation_ledger_discrepancies).
 * Canônico bank-core. Legado gateway/settlement: reconciliation_discrepancies (0026) — ver RECONCILIATION_DISCREPANCY_DUAL_TABLE.md
 */

import { pool } from '@core/database/pool';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type ReconciliationRunStatus = 'running' | 'completed' | 'failed';

export type LedgerReconciliationDiscrepancyType =
  | 'ledger_mismatch'
  | 'account_mismatch'
  | 'orphan_transaction'
  | 'orphan_ledger_entry'
  | 'settled_intent_without_credit'
  // Caminho 2 (detectar antes de endurecer) — janelas async entre transfer
  // (bank) e UPDATE de status (filas). Detecção pura, sem corretivo automático.
  // Referência: DT-CONSERVATION-OBSERVABILITY (REMEDIATION_DT_LOG.md).
  | 'payout_transferred_status_not_completed'
  | 'settlement_transferred_status_not_sent';

export interface ReconciliationRunRow {
  id: string;
  tenantId: string;
  startedAt: string;
  finishedAt: string | null;
  status: ReconciliationRunStatus;
  discrepanciesFound: number;
  metadata: Record<string, unknown>;
}

export interface LedgerDiscrepancyRow {
  id: string;
  tenantId: string;
  reconciliationRunId: string;
  type: LedgerReconciliationDiscrepancyType;
  referenceId: string;
  expectedValueCents: number | null;
  actualValueCents: number | null;
  differenceCents: number;
  detectedAt: string;
  resolved: boolean;
  resolutionNotes: string | null;
}

export async function createRun(
  tenantId: string,
  metadata: Record<string, unknown> = {}
): Promise<ReconciliationRunRow> {
  const row = await runQueryWithTenant<{
    id: string;
    tenant_id: string;
    started_at: Date;
    finished_at: Date | null;
    status: string;
    discrepancies_found: string;
    metadata: Record<string, unknown>;
  }>(
    tenantId,
    `INSERT INTO reconciliation_runs (tenant_id, status, metadata)
     VALUES ($1, 'running', $2::jsonb)
     RETURNING id, tenant_id, started_at, finished_at, status, discrepancies_found, metadata`,
    [tenantId, JSON.stringify(metadata)]
  );
  if (!row) throw new Error('createRun failed');
  return {
    id: row.id,
    tenantId: row.tenant_id,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    status: row.status as ReconciliationRunStatus,
    discrepanciesFound: Number(row.discrepancies_found),
    metadata: row.metadata || {},
  };
}

export async function finishRun(
  tenantId: string,
  runId: string,
  status: 'completed' | 'failed',
  discrepanciesFound: number,
  extraMetadata?: Record<string, unknown>
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `UPDATE reconciliation_runs
     SET status = $2, finished_at = now(), discrepancies_found = $3,
         metadata = metadata || $4::jsonb
     WHERE tenant_id = $1 AND id = $5`,
    [
      tenantId,
      status,
      discrepanciesFound,
      JSON.stringify(extraMetadata ?? {}),
      runId,
    ]
  );
}

export async function recordDiscrepancy(
  tenantId: string,
  input: {
    runId: string;
    type: LedgerReconciliationDiscrepancyType;
    referenceId: string;
    expectedValueCents: number | null;
    actualValueCents: number | null;
    differenceCents: number;
  }
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `INSERT INTO reconciliation_ledger_discrepancies (
       tenant_id, reconciliation_run_id, discrepancy_type, reference_id,
       expected_value_cents, actual_value_cents, difference_cents
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      tenantId,
      input.runId,
      input.type,
      input.referenceId,
      input.expectedValueCents,
      input.actualValueCents,
      input.differenceCents,
    ]
  );
}

export async function listOpenDiscrepancies(
  tenantId: string,
  limit = 100
): Promise<LedgerDiscrepancyRow[]> {
  const rows = await runQueriesWithTenant<{
    id: string;
    tenant_id: string;
    reconciliation_run_id: string;
    discrepancy_type: string;
    reference_id: string;
    expected_value_cents: string | null;
    actual_value_cents: string | null;
    difference_cents: string;
    detected_at: Date;
    resolved: boolean;
    resolution_notes: string | null;
  }>(
    tenantId,
    `SELECT id, tenant_id, reconciliation_run_id, discrepancy_type, reference_id,
            expected_value_cents::text, actual_value_cents::text, difference_cents::text,
            detected_at, resolved, resolution_notes
     FROM reconciliation_ledger_discrepancies
     WHERE tenant_id = $1 AND resolved = false
     ORDER BY detected_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    reconciliationRunId: r.reconciliation_run_id,
    type: r.discrepancy_type as LedgerReconciliationDiscrepancyType,
    referenceId: r.reference_id,
    expectedValueCents: r.expected_value_cents != null ? Number(r.expected_value_cents) : null,
    actualValueCents: r.actual_value_cents != null ? Number(r.actual_value_cents) : null,
    differenceCents: Number(r.difference_cents),
    detectedAt: r.detected_at.toISOString(),
    resolved: r.resolved,
    resolutionNotes: r.resolution_notes,
  }));
}

export async function getLedgerDiscrepancyById(
  tenantId: string,
  discrepancyId: string
): Promise<LedgerDiscrepancyRow | null> {
  const row = await runQueryWithTenant<{
    id: string;
    tenant_id: string;
    reconciliation_run_id: string;
    discrepancy_type: string;
    reference_id: string;
    expected_value_cents: string | null;
    actual_value_cents: string | null;
    difference_cents: string;
    detected_at: Date;
    resolved: boolean;
    resolution_notes: string | null;
  }>(
    tenantId,
    `SELECT id, tenant_id, reconciliation_run_id, discrepancy_type, reference_id,
            expected_value_cents::text, actual_value_cents::text, difference_cents::text,
            detected_at, resolved, resolution_notes
     FROM reconciliation_ledger_discrepancies
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, discrepancyId]
  );
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reconciliationRunId: row.reconciliation_run_id,
    type: row.discrepancy_type as LedgerReconciliationDiscrepancyType,
    referenceId: row.reference_id,
    expectedValueCents: row.expected_value_cents != null ? Number(row.expected_value_cents) : null,
    actualValueCents: row.actual_value_cents != null ? Number(row.actual_value_cents) : null,
    differenceCents: Number(row.difference_cents),
    detectedAt: row.detected_at.toISOString(),
    resolved: row.resolved,
    resolutionNotes: row.resolution_notes,
  };
}

export async function markResolved(
  tenantId: string,
  discrepancyId: string,
  resolutionNotes: string
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `UPDATE reconciliation_ledger_discrepancies
     SET resolved = true, resolution_notes = $3
     WHERE tenant_id = $1 AND id = $2 AND resolved = false`,
    [tenantId, discrepancyId, resolutionNotes.slice(0, 4000)]
  );
}

/** Tenants com contas bancárias (para worker). */
export async function listTenantsForReconciliation(limit = 500): Promise<string[]> {
  const r = await pool.query<{ tenant_id: string }>(
    `SELECT DISTINCT tenant_id FROM bank_accounts ORDER BY tenant_id LIMIT $1`,
    [limit]
  );
  return r.rows.map((x) => x.tenant_id);
}