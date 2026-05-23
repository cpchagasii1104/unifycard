// backend/src/core/events/event-payment.types.ts
// Tipos de execução de pagamento, estorno e chargeback — amountCents canônico

export interface ExecutePaymentInput {
  event_id: string;
  authorization_id: string;
  executed_by_actor_id: string;
  sandbox_mode: boolean;
}

export interface ExecutePaymentResult {
  executionId: string;
  eventId: string;
  authorizationId: string;
  amountCents: number;
  status: 'executed' | 'simulated';
  sandboxMode: boolean;
}

export interface RequestRefundInput {
  event_id: string;
  requested_by_actor_id: string;
  custody_id: string;
  refund_type: 'full' | 'partial' | 'chargeback' | 'cancellation';
  amount_cents?: number | null;
  reason: string;
}

export interface InitiateChargebackInput {
  event_id: string;
  initiated_by_actor_id: string;
  custody_id: string;
  amount_cents: number;
  external_reference?: string | null;
  reason: string;
}