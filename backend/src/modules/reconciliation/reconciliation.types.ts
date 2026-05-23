// Tipos do Reconciliation Engine

export type ReconciliationDiscrepancyType = 'gateway' | 'bank' | 'settlement';

export type ReconciliationDiscrepancyStatus = 'open' | 'resolved' | 'ignored';

export interface ReconciliationDiscrepancy {
  id: string;
  tenantId: string;
  type: ReconciliationDiscrepancyType;
  referenceId: string;
  referenceType: string | null;
  expectedAmountCents: number;
  actualAmountCents: number;
  currency: string;
  metadata?: Record<string, any> | null;
  status: ReconciliationDiscrepancyStatus;
  resolutionNote: string | null;
  adjustmentTransactionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateDiscrepancyInput {
  tenantId: string;
  type: ReconciliationDiscrepancyType;
  referenceId: string;
  referenceType?: string;
  expectedAmountCents: number;
  actualAmountCents: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationReport {
  tenantId: string;
  runAt: string;
  level: 'transaction' | 'settlement' | 'bank';
  discrepanciesFound: number;
  discrepancyIds: string[];
}