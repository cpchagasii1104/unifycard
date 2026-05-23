// Financial Observability Layer — logs estruturados para operações financeiras

export interface FinancialEventPayload {
  financial_event: string;
  trace_id?: string;
  transaction_id?: string;
  reference_type?: string;
  reference_id?: string;
  account_id?: string;
  amount_cents?: number;
  actor_id?: string;
  tenant_id: string;
  metadata?: Record<string, unknown>;
}

export function logFinancialEvent(event: FinancialEventPayload): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    })
  );
}

/** Payload para auditoria de operações envolvendo treasury (Prompt 50 — observabilidade apenas) */
export interface TreasuryAuditPayload {
  tenant_id: string;
  source: string;
  destination: string;
  amount_cents: number;
  operation_type: string;
  timestamp: string;
}

export function logTreasuryOperation(payload: TreasuryAuditPayload): void {
  logFinancialEvent({
    financial_event: 'treasury_operation',
    tenant_id: payload.tenant_id,
    account_id: payload.destination,
    amount_cents: payload.amount_cents,
    metadata: {
      source: payload.source,
      destination: payload.destination,
      operation_type: payload.operation_type,
      timestamp: payload.timestamp,
    },
  });
}