import type { LedgerDiscrepancyRow, LedgerReconciliationDiscrepancyType } from './reconciliation.repository';

export type DisputeAuthorityKind = 'system' | 'admin' | 'support';

/** Autor explícito; sem actor implícito ou default para criação. */
export interface ReconciliationDisputeActor {
  kind: DisputeAuthorityKind;
  actorId?: string | null;
}

export type ReconciliationDisputeStatus = 'open' | 'under_review' | 'resolved' | 'reversed';

export interface ReconciliationDisputeRow {
  id: string;
  tenantId: string;
  ledgerDiscrepancyId: string;
  status: ReconciliationDisputeStatus;
  createdByKind: DisputeAuthorityKind;
  createdByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CANONICAL_LEDGER_DISCREPANCY_TYPES: readonly LedgerReconciliationDiscrepancyType[] = [
  'ledger_mismatch',
  'account_mismatch',
  'orphan_transaction',
  'orphan_ledger_entry',
] as const;

export interface CreateDisputeFromDiscrepancyResult {
  dispute: ReconciliationDisputeRow;
  created: boolean;
  discrepancy: LedgerDiscrepancyRow;
}