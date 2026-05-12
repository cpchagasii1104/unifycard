/**
 * Repositório da tabela LEGADA `reconciliation_discrepancies` (0026: gateway/bank/settlement).
 * Não confundir com Prompt 52 (`reconciliation_ledger_discrepancies` + `reconciliation_runs`).
 * @see docs/02_decisions/RECONCILIATION_DISCREPANCY_DUAL_TABLE.md
 */
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ReconciliationDiscrepancy,
  ReconciliationDiscrepancyType,
  ReconciliationDiscrepancyStatus,
} from './reconciliation.types';

interface Row {
  id: string;
  tenant_id: string;
  discrepancy_type: string;
  reference_id: string;
  reference_type: string | null;
  expected_amount_cents: string;
  actual_amount_cents: string;
  currency: string;
  metadata: Record<string, any> | null;
  status: string;
  resolution_note: string | null;
  adjustment_transaction_id: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

function toDiscrepancy(row: Row): ReconciliationDiscrepancy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.discrepancy_type as ReconciliationDiscrepancyType,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    expectedAmountCents: Number(row.expected_amount_cents),
    actualAmountCents: Number(row.actual_amount_cents),
    currency: row.currency,
    metadata: row.metadata,
    status: row.status as ReconciliationDiscrepancyStatus,
    resolutionNote: row.resolution_note,
    adjustmentTransactionId: row.adjustment_transaction_id,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

export const reconciliationDiscrepancyRepository = {
  async create(
    tenantId: string,
    input: {
      type: ReconciliationDiscrepancyType;
      referenceId: string;
      referenceType?: string;
      expectedAmountCents: number;
      actualAmountCents: number;
      currency?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ReconciliationDiscrepancy> {
    const row = await runQueryWithTenant<Row>(
      tenantId,
      `
      INSERT INTO reconciliation_discrepancies (
        tenant_id, discrepancy_type, reference_id, reference_type,
        expected_amount_cents, actual_amount_cents, currency, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING id, tenant_id, discrepancy_type, reference_id, reference_type,
                expected_amount_cents, actual_amount_cents, currency, metadata,
                status, resolution_note, adjustment_transaction_id,
                created_at, resolved_at
      `,
      [
        tenantId,
        input.type,
        input.referenceId,
        input.referenceType ?? null,
        input.expectedAmountCents,
        input.actualAmountCents,
        input.currency ?? 'BRL',
        JSON.stringify(input.metadata ?? null),
      ]
    );
    if (!row) throw new Error('Failed to create reconciliation discrepancy');
    return toDiscrepancy(row);
  },

  async findOpenByTenant(
    tenantId: string,
    type?: ReconciliationDiscrepancyType
  ): Promise<ReconciliationDiscrepancy[]> {
    const query = type
      ? `
      SELECT id, tenant_id, discrepancy_type, reference_id, reference_type,
             expected_amount_cents, actual_amount_cents, currency, metadata,
             status, resolution_note, adjustment_transaction_id,
             created_at, resolved_at
      FROM reconciliation_discrepancies
      WHERE tenant_id = $1 AND status = 'open' AND discrepancy_type = $2
      ORDER BY created_at DESC
      `
      : `
      SELECT id, tenant_id, discrepancy_type, reference_id, reference_type,
             expected_amount_cents, actual_amount_cents, currency, metadata,
             status, resolution_note, adjustment_transaction_id,
             created_at, resolved_at
      FROM reconciliation_discrepancies
      WHERE tenant_id = $1 AND status = 'open'
      ORDER BY created_at DESC
      `;
    const rows = await runQueriesWithTenant<Row>(
      tenantId,
      query,
      type ? [tenantId, type] : [tenantId]
    );
    return (rows ?? []).map(toDiscrepancy);
  },

  async markResolved(
    tenantId: string,
    id: string,
    adjustmentTransactionId: string,
    resolutionNote?: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE reconciliation_discrepancies
      SET status = 'resolved', adjustment_transaction_id = $2, resolution_note = $3, resolved_at = now()
      WHERE tenant_id = $1 AND id = $4
      `,
      [tenantId, adjustmentTransactionId, resolutionNote ?? null, id]
    );
  },
};