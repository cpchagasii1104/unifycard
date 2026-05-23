// Financial Audit Trail — trilha de auditoria persistente (não substitui o ledger)

import type { Pool } from 'pg';

export interface FinancialAuditEvent {
  tenant_id: string;
  event_type: string;
  transaction_id?: string | null;
  account_id?: string | null;
  actor_id?: string | null;
  amount_cents?: number | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordFinancialAudit(pool: Pool, event: FinancialAuditEvent) {
  await pool.query(
    `
    INSERT INTO financial_audit_trail
    (tenant_id, event_type, transaction_id, account_id, actor_id, amount_cents, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      event.tenant_id,
      event.event_type,
      event.transaction_id ?? null,
      event.account_id ?? null,
      event.actor_id ?? null,
      event.amount_cents ?? null,
      event.metadata ?? null,
    ]
  );
}