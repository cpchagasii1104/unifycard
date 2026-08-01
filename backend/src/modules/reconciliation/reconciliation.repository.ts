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

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (F-BANK-RECONCILIATION-RELINK, 2026-07-31)
// ║ NORMA:   docs/02_decisions/RECONCILIATION_DISCREPANCY_DUAL_TABLE.md — este arquivo é o SSOT
// ║          de diagnóstico do Prompt 52 (ver createRun/recordDiscrepancy/finishRun acima).
// ║ NÃO:     abrir uma 3ª família de tabela para reconciliação manual (input do admin); NÃO usar
// ║          o módulo legado 0026 (tipos gateway/bank/settlement, arquivo reconciliation-
// ║          discrepancy na mesma pasta) — a própria decisão manda descontinuar. NÃO tratar
// ║          "engine" como coluna nova — é ATRIBUTO em metadata (a corrida é UMA entidade; o
// ║          gatilho — motor automático vs input manual do admin — é atributo dela, não tabela
// ║          separada).
// ║ EM VEZ:  reconciliação MANUAL do admin (rota core/unifybank, prefixo /admin/finance) usa
// ║          createRun/recordDiscrepancy/finishRun (acima, já existentes) com
// ║          metadata.engine='manual_admin_input' (distinto de 'prompt_52', o motor automático).
// ║          discrepancy_type='account_mismatch' é o único tipo do CHECK vivo que descreve valor
// ║          declarado × valor computado — mesma classe do uso do motor (por-conta), aqui em
// ║          escopo agregado por tenant. reference_id (uuid, sem FK) = tenantId — não há um id de
// ║          conta único quando o admin reconcilia o CONSOLIDADO (pode somar várias contas/moedas);
// ║          documentado, não inventado. Decisão registrada no cartório (REMEDIATION_DT_LOG.md)
// ║          para reversão se o dono achar errado.
// ╚════════════════════════════════════════════════════════════════

export const MANUAL_RECONCILIATION_ENGINE = 'manual_admin_input';

export interface CreateManualReconciliationRunInput {
  internalBalanceCents: number;
  externalBalanceCents: number;
  differenceCents: number;
  currency: string;
  filtersApplied?: Record<string, unknown>;
  notes?: string;
  performedByUserId: string;
}

export interface ManualReconciliationRunRow {
  reconciliationId: string;
  tenantId: string;
  internalBalanceCents: number;
  externalBalanceCents: number;
  differenceCents: number;
  currency: string;
  filtersApplied: Record<string, unknown>;
  notes: string | null;
  performedByUserId: string | null;
  createdAt: string;
}

/**
 * Cria uma reconciliação MANUAL (input do admin) no SSOT canônico.
 * 🔴 DECISÃO (F-BANK-RECONCILIATION-RELINK): a run é SEMPRE gravada (append-only, mesmo em
 * diferença zero — "zero é uma afirmação: o admin conferiu e bateu", não ausência de checagem).
 * A linha de discrepância (`reconciliation_ledger_discrepancies`) só é gravada quando
 * differenceCents != 0 — preserva o invariante que já vale para o motor automático
 * (discrepancies_found == contagem de linhas filhas == só problemas reais, nunca "cheque ok").
 * Os 3 valores (internal/external/difference) ficam TAMBÉM no metadata da run — snapshot honesto
 * que sobrevive à leitura mesmo quando não há linha de discrepância (diferença zero).
 */
export async function createManualReconciliationRun(
  tenantId: string,
  input: CreateManualReconciliationRunInput
): Promise<ManualReconciliationRunRow> {
  const run = await createRun(tenantId, {
    engine: MANUAL_RECONCILIATION_ENGINE,
    currency: input.currency,
    internalBalanceCents: input.internalBalanceCents,
    externalBalanceCents: input.externalBalanceCents,
    differenceCents: input.differenceCents,
    filtersApplied: input.filtersApplied ?? {},
    notes: input.notes ?? null,
    performedByUserId: input.performedByUserId,
  });

  let discrepanciesFound = 0;
  if (input.differenceCents !== 0) {
    discrepanciesFound = 1;
    await recordDiscrepancy(tenantId, {
      runId: run.id,
      type: 'account_mismatch',
      referenceId: tenantId,
      expectedValueCents: input.internalBalanceCents,
      actualValueCents: input.externalBalanceCents,
      differenceCents: input.differenceCents,
    });
  }
  await finishRun(tenantId, run.id, 'completed', discrepanciesFound);

  return {
    reconciliationId: run.id,
    tenantId,
    internalBalanceCents: input.internalBalanceCents,
    externalBalanceCents: input.externalBalanceCents,
    differenceCents: input.differenceCents,
    currency: input.currency,
    filtersApplied: input.filtersApplied ?? {},
    notes: input.notes ?? null,
    performedByUserId: input.performedByUserId,
    createdAt: run.startedAt,
  };
}

function toManualReconciliationRunRow(row: {
  id: string;
  tenant_id: string;
  started_at: Date;
  metadata: Record<string, any>;
  expected_value_cents: string | null;
  actual_value_cents: string | null;
  difference_cents: string | null;
}): ManualReconciliationRunRow {
  const md = row.metadata || {};
  // Governado (linha de discrepância) tem prioridade quando existe; metadata é o fallback honesto
  // pro caso diferença-zero (sem linha filha).
  const internalBalanceCents = row.expected_value_cents != null ? Number(row.expected_value_cents) : Number(md.internalBalanceCents ?? 0);
  const externalBalanceCents = row.actual_value_cents != null ? Number(row.actual_value_cents) : Number(md.externalBalanceCents ?? 0);
  const differenceCents = row.difference_cents != null ? Number(row.difference_cents) : Number(md.differenceCents ?? 0);
  return {
    reconciliationId: row.id,
    tenantId: row.tenant_id,
    internalBalanceCents,
    externalBalanceCents,
    differenceCents,
    currency: md.currency ?? 'BRL',
    filtersApplied: md.filtersApplied ?? {},
    notes: md.notes ?? null,
    performedByUserId: md.performedByUserId ?? null,
    createdAt: row.started_at.toISOString(),
  };
}

export interface ManualReconciliationRunFilters {
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/** Lista reconciliações MANUAIS (filtra por metadata.engine — o gatilho é atributo, não tabela). */
export async function listManualReconciliationRuns(
  tenantId: string,
  filters: ManualReconciliationRunFilters = {}
): Promise<ManualReconciliationRunRow[]> {
  let query = `
    SELECT r.id, r.tenant_id, r.started_at, r.metadata,
           d.expected_value_cents::text AS expected_value_cents,
           d.actual_value_cents::text AS actual_value_cents,
           d.difference_cents::text AS difference_cents
    FROM reconciliation_runs r
    LEFT JOIN reconciliation_ledger_discrepancies d
      ON d.reconciliation_run_id = r.id AND d.discrepancy_type = 'account_mismatch'
    WHERE r.tenant_id = $1
      AND r.metadata->>'engine' = $2
  `;
  const params: any[] = [tenantId, MANUAL_RECONCILIATION_ENGINE];
  let idx = 3;

  if (filters.currency) {
    query += ` AND r.metadata->>'currency' = $${idx}`;
    params.push(filters.currency);
    idx++;
  }
  if (filters.startDate) {
    query += ` AND r.started_at >= $${idx}`;
    params.push(filters.startDate);
    idx++;
  }
  if (filters.endDate) {
    query += ` AND r.started_at <= $${idx}`;
    params.push(filters.endDate);
    idx++;
  }
  query += ` ORDER BY r.started_at DESC`;
  if (filters.limit) {
    query += ` LIMIT $${idx}`;
    params.push(filters.limit);
    idx++;
  }
  if (filters.offset) {
    query += ` OFFSET $${idx}`;
    params.push(filters.offset);
    idx++;
  }

  const rows = await runQueriesWithTenant<{
    id: string;
    tenant_id: string;
    started_at: Date;
    metadata: Record<string, any>;
    expected_value_cents: string | null;
    actual_value_cents: string | null;
    difference_cents: string | null;
  }>(tenantId, query, params);

  return rows.map(toManualReconciliationRunRow);
}

/** Busca UMA reconciliação MANUAL por id (mesma composição run+discrepância do list). */
export async function getManualReconciliationRunById(
  tenantId: string,
  runId: string
): Promise<ManualReconciliationRunRow | null> {
  const row = await runQueryWithTenant<{
    id: string;
    tenant_id: string;
    started_at: Date;
    metadata: Record<string, any>;
    expected_value_cents: string | null;
    actual_value_cents: string | null;
    difference_cents: string | null;
  }>(
    tenantId,
    `
    SELECT r.id, r.tenant_id, r.started_at, r.metadata,
           d.expected_value_cents::text AS expected_value_cents,
           d.actual_value_cents::text AS actual_value_cents,
           d.difference_cents::text AS difference_cents
    FROM reconciliation_runs r
    LEFT JOIN reconciliation_ledger_discrepancies d
      ON d.reconciliation_run_id = r.id AND d.discrepancy_type = 'account_mismatch'
    WHERE r.tenant_id = $1 AND r.id = $2 AND r.metadata->>'engine' = $3
    LIMIT 1
    `,
    [tenantId, runId, MANUAL_RECONCILIATION_ENGINE]
  );
  return row ? toManualReconciliationRunRow(row) : null;
}

/** Tenants para reconciliação (para worker). */
export async function listTenantsForReconciliation(limit = 500): Promise<string[]> {
  // 🔴 DECISION-0149: discovery via tabela `tenants` (registry NÃO-RLS), NÃO varrendo bank_accounts (RLS+FORCE)
  // — sob unificard_app a varredura de bank_accounts retornaria 0. O loop por-tenant a jusante já usa
  // getClientWithTenant (tenant-context). Cross-tenant = descobrir não-RLS + iterar por-tenant.
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM tenants ORDER BY id LIMIT $1`,
    [limit]
  );
  return r.rows.map((x) => x.id);
}