/**
 * Persistência de reconciliation_disputes (0088). Apenas ledger_discrepancy_id canónico.
 */

import type { PoolClient } from 'pg';
import { runQueryWithTenant } from '@core/database/pool';
import type { DisputeAuthorityKind, ReconciliationDisputeRow, ReconciliationDisputeStatus } from './reconciliation-dispute.types';

function mapRow(r: {
  id: string;
  tenant_id: string;
  ledger_discrepancy_id: string;
  status: string;
  created_by_kind: string;
  created_by_actor_id: string | null;
  created_at: Date;
  updated_at: Date;
}): ReconciliationDisputeRow {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    ledgerDiscrepancyId: r.ledger_discrepancy_id,
    status: r.status as ReconciliationDisputeStatus,
    createdByKind: r.created_by_kind as DisputeAuthorityKind,
    createdByActorId: r.created_by_actor_id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function findDisputeByLedgerDiscrepancyId(
  tenantId: string,
  ledgerDiscrepancyId: string
): Promise<ReconciliationDisputeRow | null> {
  const row = await runQueryWithTenant<{
    id: string;
    tenant_id: string;
    ledger_discrepancy_id: string;
    status: string;
    created_by_kind: string;
    created_by_actor_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    tenantId,
    `SELECT id, tenant_id, ledger_discrepancy_id, status, created_by_kind, created_by_actor_id, created_at, updated_at
     FROM reconciliation_disputes
     WHERE tenant_id = $1 AND ledger_discrepancy_id = $2
     LIMIT 1`,
    [tenantId, ledgerDiscrepancyId]
  );
  return row ? mapRow(row) : null;
}

export async function findDisputeById(
  tenantId: string,
  disputeId: string
): Promise<ReconciliationDisputeRow | null> {
  const row = await runQueryWithTenant<{
    id: string;
    tenant_id: string;
    ledger_discrepancy_id: string;
    status: string;
    created_by_kind: string;
    created_by_actor_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    tenantId,
    `SELECT id, tenant_id, ledger_discrepancy_id, status, created_by_kind, created_by_actor_id, created_at, updated_at
     FROM reconciliation_disputes
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, disputeId]
  );
  return row ? mapRow(row) : null;
}

function sanitizeParams(params: unknown[]): unknown[] {
  return params.map((p) => (p === undefined ? null : p));
}

/** Mesma conexão/transação; exige tenant já configurado no client. */
export async function insertReconciliationDisputeWithClient(
  client: PoolClient,
  tenantId: string,
  input: {
    ledgerDiscrepancyId: string;
    createdByKind: DisputeAuthorityKind;
    createdByActorId: string | null;
  }
): Promise<ReconciliationDisputeRow> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    ledger_discrepancy_id: string;
    status: string;
    created_by_kind: string;
    created_by_actor_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO reconciliation_disputes (
       tenant_id, ledger_discrepancy_id, status, created_by_kind, created_by_actor_id
     ) VALUES ($1, $2, 'open', $3, $4)
     RETURNING id, tenant_id, ledger_discrepancy_id, status, created_by_kind, created_by_actor_id, created_at, updated_at`,
    sanitizeParams([tenantId, input.ledgerDiscrepancyId, input.createdByKind, input.createdByActorId])
  );
  const row = result.rows[0];
  if (!row) throw new Error('INSERT_RECONCILIATION_DISPUTE_FAILED');
  return mapRow(row);
}

/** Só avança se `status` atual for `expectedCurrentStatus` (concorrência / estado inválido → 0 rows). */
export async function updateDisputeStatusWithClient(
  client: PoolClient,
  tenantId: string,
  disputeId: string,
  status: ReconciliationDisputeStatus,
  expectedCurrentStatus: ReconciliationDisputeStatus
): Promise<ReconciliationDisputeRow | null> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    ledger_discrepancy_id: string;
    status: string;
    created_by_kind: string;
    created_by_actor_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE reconciliation_disputes
     SET status = $3, updated_at = now()
     WHERE tenant_id = $1 AND id = $2 AND status = $4
     RETURNING id, tenant_id, ledger_discrepancy_id, status, created_by_kind, created_by_actor_id, created_at, updated_at`,
    sanitizeParams([tenantId, disputeId, status, expectedCurrentStatus])
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}