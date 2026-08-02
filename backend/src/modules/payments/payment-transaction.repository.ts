// backend/src/modules/payments/payment-transaction.repository.ts
// Estado interno de execução: intent → transaction → bank (SSOT de estado da execução).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PaymentCurrency, PaymentTransaction } from '../marketplace/payment-intent.types';

interface PaymentTransactionRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  trace_id: string;
  amount_cents: string;
  currency: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  bank_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

function toPaymentTransaction(row: PaymentTransactionRow): PaymentTransaction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    paymentIntentId: row.payment_intent_id,
    traceId: row.trace_id,
    bankTransactionId: row.bank_transaction_id ?? null,
    amountCents: parseInt(String(row.amount_cents), 10),
    currency: row.currency as PaymentCurrency,
    status: row.status as PaymentTransaction['status'],
    errorCode: (row.metadata as { error_code?: string } | null)?.error_code ?? null,
    paymentMethod: row.provider,
    metadata: row.metadata || null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

class PaymentTransactionRepository {
  async findByIntentId(tenantId: string, paymentIntentId: string): Promise<PaymentTransaction | null> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
             provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      FROM payment_transactions
      WHERE tenant_id = $1 AND payment_intent_id = $2
      LIMIT 1
      `,
      [tenantId, paymentIntentId]
    );
    return row ? toPaymentTransaction(row) : null;
  }

  async getTransactionById(tenantId: string, transactionId: string): Promise<PaymentTransaction | null> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
             provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      FROM payment_transactions
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, transactionId]
    );
    return row ? toPaymentTransaction(row) : null;
  }

  async getTransactionByIdempotencyKey(
    tenantId: string,
    paymentIntentId: string,
    idempotencyKey: string
  ): Promise<PaymentTransaction | null> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
             provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      FROM payment_transactions
      WHERE tenant_id = $1
        AND payment_intent_id = $2
        AND (metadata->>'idempotency_key') = $3
      LIMIT 1
      `,
      [tenantId, paymentIntentId, idempotencyKey]
    );
    return row ? toPaymentTransaction(row) : null;
  }

  /**
   * Garante 1 linha por (tenant, payment_intent). Se já existir, devolve desde que amount coincida.
   */
  async createTransaction(
    tenantId: string,
    paymentIntentId: string,
    amountCents: number,
    currency: string,
    traceId: string,
    idempotencyKey?: string
  ): Promise<PaymentTransaction> {
    const existing = await this.findByIntentId(tenantId, paymentIntentId);
    if (existing) {
      if (existing.amountCents !== amountCents) {
        throw new Error('PAYMENT_TRANSACTION_AMOUNT_CONFLICT');
      }
      if (existing.status === 'failed') {
        throw new Error('PAYMENT_TRANSACTION_PREVIOUSLY_FAILED');
      }
      return existing;
    }

    const metadata: Record<string, unknown> = { trace_id: traceId };
    if (idempotencyKey) {
      metadata.idempotency_key = idempotencyKey;
    }

    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      INSERT INTO payment_transactions (
        tenant_id, payment_intent_id, trace_id, amount_cents, currency, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6::jsonb)
      RETURNING id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
                provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      `,
      [tenantId, paymentIntentId, traceId, amountCents, currency || 'BRL', JSON.stringify(metadata)]
    );

    if (!row) {
      throw new Error('Falha ao criar payment_transaction');
    }
    return toPaymentTransaction(row);
  }

  async updateMetadata(
    tenantId: string,
    transactionId: string,
    metadata: Record<string, unknown>
  ): Promise<PaymentTransaction> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      UPDATE payment_transactions
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
          updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
                provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      `,
      [tenantId, transactionId, JSON.stringify(metadata)]
    );
    if (!row) {
      throw new Error('payment_transaction não encontrado ao atualizar metadata');
    }
    return toPaymentTransaction(row);
  }

  async setProviderReference(
    tenantId: string,
    transactionId: string,
    provider: string,
    providerReference: string
  ): Promise<PaymentTransaction> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      UPDATE payment_transactions
      SET provider = $3,
          provider_reference = $4,
          updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
                provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      `,
      [tenantId, transactionId, provider, providerReference]
    );
    if (!row) {
      throw new Error('payment_transaction não encontrado ao definir provider');
    }
    return toPaymentTransaction(row);
  }

  async markAsSuccess(
    tenantId: string,
    transactionId: string,
    bankTransactionId: string
  ): Promise<PaymentTransaction> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      UPDATE payment_transactions
      SET status = 'success',
          bank_transaction_id = $3,
          updated_at = now()
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
                provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      `,
      [tenantId, transactionId, bankTransactionId]
    );
    if (row) {
      return toPaymentTransaction(row);
    }
    const existing = await this.getTransactionById(tenantId, transactionId);
    if (existing?.status === 'success') {
      return existing;
    }
    throw new Error('payment_transaction não encontrado ou não está PENDING para markAsSuccess');
  }

  async markAsFailed(tenantId: string, transactionId: string, errorCode: string): Promise<PaymentTransaction> {
    const row = await runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      UPDATE payment_transactions
      SET status = 'failed',
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
          updated_at = now()
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
                provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      `,
      [tenantId, transactionId, JSON.stringify({ error_code: errorCode })]
    );
    if (row) {
      return toPaymentTransaction(row);
    }
    const existing = await this.getTransactionById(tenantId, transactionId);
    if (existing?.status === 'failed') {
      return existing;
    }
    throw new Error('payment_transaction não encontrado ou não está PENDING para markAsFailed');
  }

  async listTransactionsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PaymentTransaction[]> {
    const rows = await runQueriesWithTenant<PaymentTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, trace_id, amount_cents, currency, status,
             provider, provider_reference, bank_transaction_id, metadata, created_at, updated_at
      FROM payment_transactions
      WHERE tenant_id = $1 AND payment_intent_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, paymentIntentId]
    );
    return rows.map(toPaymentTransaction);
  }
}

export const paymentTransactionRepository = new PaymentTransactionRepository();
