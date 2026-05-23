import { v5 as uuidv5 } from 'uuid';

/** Namespace fixo (UUID) para event_id determinístico B2B — idempotência outbox + event_log. */
const B2B_PAYMENT_COMPLETED_NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function b2bPaymentCompletedEventId(intentId: string): string {
  return uuidv5(`b2b.payment.completed:${intentId}`, B2B_PAYMENT_COMPLETED_NS);
}