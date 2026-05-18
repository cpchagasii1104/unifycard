// PIX Adapter Simulado — recebe webhook PIX simulado e enfileira PaymentEvent.
// Guard de idempotência e rate limit. Não acessa bank_ledger, bank_transactions nem bank_accounts.

import { createHash } from 'crypto';
import type { PaymentEvent } from '@core/events/payment-events-queue';
import { enqueuePaymentEvent } from '@core/events/payment-events-queue';
import { recordWebhookEvent } from '@modules/gateway/gateway-webhook-repository';
import { checkRateLimit } from '@modules/rate-limit/financial-rate-limit-guard';

export interface PixWebhookPayload {
  txid: string;
  amount: number;
  tenant_id: string;
  actor_id: string;
  [key: string]: unknown;
}

function validatePayload(payload: unknown): asserts payload is PixWebhookPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload inválido');
  }
  const p = payload as Record<string, unknown>;
  if (!p.txid || typeof p.txid !== 'string') {
    throw new Error('txid obrigatório');
  }
  if (p.amount === undefined || p.amount === null || (typeof p.amount !== 'number' && typeof p.amount !== 'string')) {
    throw new Error('amount obrigatório');
  }
  if (!p.tenant_id || typeof p.tenant_id !== 'string') {
    throw new Error('tenant_id obrigatório');
  }
  if (!p.actor_id || typeof p.actor_id !== 'string') {
    throw new Error('actor_id obrigatório');
  }
}

/**
 * Converte amount para centavos.
 * Assume amount em reais (ex.: 100 → 10000 centavos). Se já vier em centavos, usar diretamente.
 */
function amountToCents(amount: number | string): number {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n) || n < 0) {
    throw new Error('amount inválido');
  }
  if (n >= 1e9) {
    return Math.round(n);
  }
  return Math.round(n * 100);
}

function payloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Processa webhook PIX simulado: valida, guard de idempotência, mapeia para PaymentEvent e enfileira.
 */
export async function handlePixWebhook(payload: unknown): Promise<void> {
  validatePayload(payload);
  await checkRateLimit(payload.tenant_id, payload.tenant_id, 'webhook_event');
  const hash = payloadHash(payload);
  const isNew = await recordWebhookEvent('pix', payload.txid, hash);
  if (!isNew) {
    console.warn('DUPLICATE_WEBHOOK_BLOCKED');
    return;
  }
  const amount_cents = amountToCents(payload.amount);
  const event: PaymentEvent = {
    type: 'PIX_PAYMENT_CONFIRMED',
    tenant_id: payload.tenant_id,
    reference_type: 'pix_payment',
    reference_id: payload.txid,
    amount_cents,
    actor_id: payload.actor_id,
    metadata: { ...payload },
  };
  await enqueuePaymentEvent(event);
}