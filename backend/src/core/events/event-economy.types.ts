// backend/src/core/events/event-economy.types.ts
// Tipos da camada econômica de eventos — amountCents canônico

export interface ProcessCheckoutInput {
  eventId: string;
  attendeeActorId: string;
  quantity: number;
}

export interface SplitRuleResult {
  targetType: string;
  percentage: number;
}

export interface CheckoutSplitItem {
  rule: SplitRuleResult;
  amountCents: number;
  transactionId: string;
}

export interface CheckoutSplitResult {
  splits: CheckoutSplitItem[];
}

export interface CheckoutResult {
  eventId: string;
  attendeeId: string;
  transactionId: string;
  totalAmountCents: number;
  splitResult: CheckoutSplitResult;
}

/** Part do split declarativo (por destino) */
export interface CalculateSplitPart {
  target_id: string;
  target_type: string;
  amount_cents: number;
  percentage: number;
  role: string;
}

export interface CalculateSplitInput {
  event_id: string;
  custody_id: string;
  parts: CalculateSplitPart[];
  rules_version?: string | null;
}