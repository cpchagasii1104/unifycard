/**
 * Payload de auditoria: só campos explícitos; sem inferência nem enriquecimento automático.
 */

import type { LedgerDiscrepancyRow } from './reconciliation.repository';

export function buildDisputeAuditPayload(
  discrepancy: Pick<LedgerDiscrepancyRow, 'id' | 'referenceId'>,
  explicitReason?: string | null
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    discrepancy_id: discrepancy.id,
    reference_id: discrepancy.referenceId,
  };
  if (explicitReason != null && String(explicitReason).trim() !== '') {
    payload.reason = String(explicitReason).trim();
  }
  return payload;
}