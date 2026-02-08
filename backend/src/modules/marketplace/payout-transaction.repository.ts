// backend/src/modules/marketplace/payout-transaction.repository.ts
// SPRINT 40.2: MARKETPLACE EXECUÇÃO - Payout Real
// Repository para transações de payout

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PayoutTransaction } from './payout.types';

interface PayoutTransactionRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  payment_split_id: string;
  recipient_actor_id: string;
  bank_transaction_id: string | null;
  amountCents: string;
  currency: string;
  status: string;
  error_code: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class PayoutTransactionRepository {
  /**
   * Converte row para PayoutTransaction
   */
  private toTransaction(row: PayoutTransactionRow): PayoutTransaction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      paymentIntentId: row.payment_intent_id,
      paymentSplitId: row.payment_split_id,
      recipientActorId: row.recipient_actor_id,
      bankTransactionId: row.bank_transaction_id,
      amountCents: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as any,
      errorCode: row.error_code,
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Busca transação por idempotency key
   */
  async getTransactionByIdempotencyKey(
    tenantId: string,
    paymentIntentId: string,
    paymentSplitId: string,
    idempotencyKey: string
  ): Promise<PayoutTransaction | null> {
    const row = await runQueryWithTenant<PayoutTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
             bank_transaction_id, amount, currency, status, error_code,
             metadata, createdAt, updatedAt
      FROM payout_transactions
      WHERE tenant_id = $1
        AND payment_intent_id = $2
        AND payment_split_id = $3
        AND metadata->>'idempotency_key' = $4
        AND status IN ('PENDING', 'SUCCESS')
      ORDER BY createdAt DESC
      LIMIT 1
      `,
      [tenantId, paymentIntentId, paymentSplitId, idempotencyKey]
    );

    return row ? this.toTransaction(row) : null;
  }

  /**
   * Cria transação de payout
   */
  async createTransaction(
    tenantId: string,
    paymentIntentId: string,
    paymentSplitId: string,
    recipientActorId: string,
    amountCents: number,
    currency: string,
    idempotencyKey?: string
  ): Promise<PayoutTransaction> {
    const metadata = idempotencyKey ? { idempotency_key: idempotencyKey } : {};

    const row = await runQueryWithTenant<PayoutTransactionRow>(
      tenantId,
      `
      INSERT INTO payout_transactions (
        tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
        amount, currency, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
                bank_transaction_id, amount, currency, status, error_code,
                metadata, createdAt, updatedAt
      `,
      [tenantId, paymentIntentId, paymentSplitId, recipientActorId, amount, currency, 'PENDING', JSON.stringify(metadata)]
    );

    if (!row) {
      throw new Error('Erro ao criar payout transaction');
    }

    return this.toTransaction(row);
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<PayoutTransaction | null> {
    const row = await runQueryWithTenant<PayoutTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
             bank_transaction_id, amount, currency, status, error_code,
             metadata, createdAt, updatedAt
      FROM payout_transactions
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, transactionId]
    );

    return row ? this.toTransaction(row) : null;
  }

  /**
   * Lista transações de um payment intent
   */
  async listTransactionsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PayoutTransaction[]> {
    const rows = await runQueriesWithTenant<PayoutTransactionRow>(
      tenantId,
      `
      SELECT id, tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
             bank_transaction_id, amount, currency, status, error_code,
             metadata, createdAt, updatedAt
      FROM payout_transactions
      WHERE tenant_id = $1 AND payment_intent_id = $2
      ORDER BY createdAt ASC
      `,
      [tenantId, paymentIntentId]
    );

    return rows.map((row) => this.toTransaction(row));
  }

  /**
   * Atualiza transação (sucesso)
   */
  async markAsSuccess(
    tenantId: string,
    transactionId: string,
    bankTransactionId: string
  ): Promise<PayoutTransaction> {
    const row = await runQueryWithTenant<PayoutTransactionRow>(
      tenantId,
      `
      UPDATE payout_transactions
      SET status = 'SUCCESS', bank_transaction_id = $1
      WHERE tenant_id = $2 AND id = $3
      RETURNING id, tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
                bank_transaction_id, amount, currency, status, error_code,
                metadata, createdAt, updatedAt
      `,
      [bankTransactionId, tenantId, transactionId]
    );

    if (!row) {
      throw new Error('Payout transaction não encontrada');
    }

    return this.toTransaction(row);
  }

  /**
   * Atualiza transação (falha)
   */
  async markAsFailed(
    tenantId: string,
    transactionId: string,
    errorCode?: string
  ): Promise<PayoutTransaction> {
    const row = await runQueryWithTenant<PayoutTransactionRow>(
      tenantId,
      `
      UPDATE payout_transactions
      SET status = 'FAILED', error_code = $1
      WHERE tenant_id = $2 AND id = $3
      RETURNING id, tenant_id, payment_intent_id, payment_split_id, recipient_actor_id,
                bank_transaction_id, amount, currency, status, error_code,
                metadata, createdAt, updatedAt
      `,
      [errorCode || null, tenantId, transactionId]
    );

    if (!row) {
      throw new Error('Payout transaction não encontrada');
    }

    return this.toTransaction(row);
  }
}

export const payoutTransactionRepository = new PayoutTransactionRepository();




