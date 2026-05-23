// Payment Event Processor — processa eventos de gateway (PIX, Stripe, etc.).
// Encaminha para o resolver que usa apenas bankTransactionService (SSOT).

import type { PaymentEvent } from '@core/events/payment-events-queue';
import { resolvePaymentEvent } from './payment-event-resolver';

export async function processPaymentEvent(event: PaymentEvent): Promise<void> {
  console.log('PROCESSING_PAYMENT_EVENT', event);
  await resolvePaymentEvent(event);
}