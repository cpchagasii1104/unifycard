// backend/src/modules/marketplace/payment-transaction.repository.ts
// SPRINT 39.2: MARKETPLACE EXECUÇÃO - Payment Execution (LEGACY)
//
// ⚠️ LEGACY — GATE 3 (SSOT)
//
// Este repositório representa transações de pagamento do MARKETPLACE LEGACY.
//
// ❌ NÃO cria transação
// ❌ NÃO atualiza status
// ❌ NÃO altera metadata
// ❌ NÃO decide estado financeiro
//
// ✅ Permitido apenas:
// - leitura histórica
// - auditoria
// - observabilidade
//
// A verdade financeira vive EXCLUSIVAMENTE no Bank.

import db from '@core/db';
import type { PaymentTransaction } from './payment-intent.types';

interface PaymentTransactionRow {
  id: string;
  tenant_id: string;
  payment_intent_id: string;
  bank_transaction_id: string | null;
  amountCents: string;
  currency: string;
  status: string;
  error_code: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class PaymentTransactionRepository {
  /**
   * Conversão LEGACY.
   * 🔴 Valor financeiro INVALIDADO.
   */
  private toTransaction(row: PaymentTransactionRow): PaymentTransaction {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      paymentIntentId: row.payment_intent_id,
      bankTransactionId: row.bank_transaction_id,
      amountCents: 0, // 🔴 dinheiro invalidado (Gate 3)
      currency: row.currency as any,
      status: row.status as any,
      errorCode: row.error_code,
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // =====================================================
  // 🟡 LEITURA HISTÓRICA — PERMITIDA
  // =====================================================

  async getTransactionByIdempotencyKey(
    tenantId: string,
    paymentIntentId: string,
    idempotencyKey: string
  ): Promise<PaymentTransaction | null> {
    const row = await db.runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      {
        text: `
          SELECT id, tenant_id, payment_intent_id, bank_transaction_id,
                 amount, currency, status, error_code,
                 metadata, createdAt, updatedAt
          FROM payment_transactions
          WHERE tenant_id = $1
            AND payment_intent_id = $2
            AND metadata->>'idempotency_key' = $3
          ORDER BY createdAt DESC
          LIMIT 1
        `,
        values: [tenantId, paymentIntentId, idempotencyKey],
      }
    );

    return row ? this.toTransaction(row) : null;
  }

  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<PaymentTransaction | null> {
    const row = await db.runQueryWithTenant<PaymentTransactionRow>(
      tenantId,
      {
        text: `
          SELECT id, tenant_id, payment_intent_id, bank_transaction_id,
                 amount, currency, status, error_code,
                 metadata, createdAt, updatedAt
          FROM payment_transactions
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1
        `,
        values: [tenantId, transactionId],
      }
    );

    return row ? this.toTransaction(row) : null;
  }

  async listTransactionsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PaymentTransaction[]> {
    const rows = await db.runQueriesWithTenant<PaymentTransactionRow>(
      tenantId,
      {
        text: `
          SELECT id, tenant_id, payment_intent_id, bank_transaction_id,
                 amount, currency, status, error_code,
                 metadata, createdAt, updatedAt
          FROM payment_transactions
          WHERE tenant_id = $1 AND payment_intent_id = $2
          ORDER BY createdAt DESC
        `,
        values: [tenantId, paymentIntentId],
      }
    );

    return rows.map((row) => this.toTransaction(row));
  }

  // =====================================================
  // 🔴 ESCRITA / EXECUÇÃO — BLOQUEADA
  // =====================================================

  async createTransaction(): Promise<never> {
    throw new Error(
      '[GATE 3] paymentTransactionRepository.createTransaction() BLOQUEADO. ' +
      'Criação de transação deve ocorrer no Bank.'
    );
  }

  async markAsSuccess(): Promise<never> {
    throw new Error(
      '[GATE 3] paymentTransactionRepository.markAsSuccess() BLOQUEADO.'
    );
  }

  async markAsFailed(): Promise<never> {
    throw new Error(
      '[GATE 3] paymentTransactionRepository.markAsFailed() BLOQUEADO.'
    );
  }

  async updateMetadata(): Promise<never> {
    throw new Error(
      '[GATE 3] paymentTransactionRepository.updateMetadata() BLOQUEADO.'
    );
  }
}

export const paymentTransactionRepository =
  new PaymentTransactionRepository();


