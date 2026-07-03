// Financial Audit Trail — trilha de auditoria persistente (não substitui o ledger)

import { runQueryWithTenant } from '@core/database/pool';

export interface FinancialAuditEvent {
  tenant_id: string;
  event_type: string;
  transaction_id?: string | null;
  account_id?: string | null;
  actor_id?: string | null;
  amount_cents?: number | null;
  metadata?: Record<string, unknown> | null;
}

// 🔴 F-ROUND2-AUDIT-REMEDIATION (achado N1 da re-auditoria adversarial rodada 2, 2026-07-02):
// financial_audit_trail ganhou RLS+FORCE em 20260702160000 (Grupo A). O INSERT era feito via pool
// CRU (sem tenant-context) — sob unificard_app o WITH CHECK rejeitava a linha, e o caller
// best-effort (bank-transaction.service) engolia o erro → a trilha de auditoria financeira PARAVA
// de ser escrita silenciosamente em produção (garantia institucional "auditoria completa append-only"
// degradando sem alarme). Fix: runQueryWithTenant seta app.current_tenant = event.tenant_id (o MESMO
// tenant do INSERT), satisfazendo a policy. O tenant_id já vem no evento; nenhuma mudança de contrato.
export async function recordFinancialAudit(event: FinancialAuditEvent): Promise<void> {
  await runQueryWithTenant(
    event.tenant_id,
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
