// backend/src/core/economy/transactions/transaction.service.ts
//
// ⚠️ LEGACY — GATE 3 (SSOT)
//
// Implementação histórica de transações financeiras baseada em
// structures LEGACY (`transactions`, `accounts`, `ledger`).
//
// ❌ Execução financeira BLOQUEADA
// ❌ Escrita em saldo BLOQUEADA
// ❌ Escrita em ledger BLOQUEADA
// ❌ Decisão financeira BLOQUEADA
//
// ✅ Permitido apenas:
// - leitura histórica
// - auditoria
// - compatibilidade transitória
//
// A verdade financeira vive EXCLUSIVAMENTE no Bank:
// - bank_accounts (estrutura)
// - bank_transactions
// - bank_ledger (SSOT)
// - bank_splits

import db from '@core/db';
import type {
  Transaction,
  CreateTransactionInput,
  TransferResult,
  TransactionStatus,
} from './transaction.types';

type TransactionRow = {
  transaction_id: string;
  tenant_id: string;
  from_account: string;
  to_account: string;
  from_global_user_id: string | null;
  to_global_user_id: string | null;
  amountCents: string;
  event_id: string;
  status: string;
  metadata: any;
  createdAt: Date;
};

class TransactionService {
  /**
   * Conversão LEGACY.
   * ⚠️ Valor financeiro INVALIDADO.
   */
  private toTransaction(row: TransactionRow): Transaction {
    return {
      transactionId: row.transaction_id,
      tenantId: row.tenant_id,
      fromAccount: row.from_account,
      toAccount: row.to_account,
      fromGlobalUserId: row.from_global_user_id ?? undefined,
      toGlobalUserId: row.to_global_user_id ?? undefined,
      amountCents: 0, // 🔴 VALOR LEGACY INVALIDADO (Gate 3)
      eventId: row.event_id,
      status: row.status as TransactionStatus,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    };
  }

  // =====================================================
  // 🔴 EXECUÇÃO FINANCEIRA — BLOQUEADA
  // =====================================================

  async transfer(
    _tenantId: string,
    _input: CreateTransactionInput
  ): Promise<never> {
    throw new Error(
      '[GATE 3] TransactionService.transfer() BLOQUEADO. ' +
      'Execução financeira deve ocorrer exclusivamente no Bank.'
    );
  }

  // =====================================================
  // 🟡 LEITURAS HISTÓRICAS — LEGACY
  // =====================================================

  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<Transaction | null> {
    const row = await db.runQueryWithTenant<TransactionRow>(
      tenantId,
      {
        text: `
          SELECT transaction_id, tenant_id, from_account, to_account,
                 from_global_user_id, to_global_user_id,
                 amount, event_id, status, metadata, createdAt
          FROM transactions
          WHERE transaction_id = $1
          LIMIT 1
        `,
        values: [transactionId],
      }
    );

    return row ? this.toTransaction(row) : null;
  }

  async getTransactionByEventId(
    tenantId: string,
    eventId: string
  ): Promise<Transaction | null> {
    const row = await db.runQueryWithTenant<TransactionRow>(
      tenantId,
      {
        text: `
          SELECT transaction_id, tenant_id, from_account, to_account,
                 from_global_user_id, to_global_user_id,
                 amount, event_id, status, metadata, createdAt
          FROM transactions
          WHERE event_id = $1
          LIMIT 1
        `,
        values: [eventId],
      }
    );

    return row ? this.toTransaction(row) : null;
  }

  async getTransactionsByAccount(
    tenantId: string,
    accountId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Transaction[]> {
    const { limit = 50, offset = 0 } = options;

    const rows = await db.runQueriesWithTenant<TransactionRow>(
      tenantId,
      {
        text: `
          SELECT transaction_id, tenant_id, from_account, to_account,
                 from_global_user_id, to_global_user_id,
                 amount, event_id, status, metadata, createdAt
          FROM transactions
          WHERE from_account = $1 OR to_account = $1
          ORDER BY createdAt DESC
          LIMIT $2 OFFSET $3
        `,
        values: [accountId, limit, offset],
      }
    );

    return rows.map((r) => this.toTransaction(r));
  }

  /**
   * ⚠️ LEGACY TRANSITÓRIO
   * Não usar para decisão.
   * Remoção prevista no Gate 5.
   */
  async getTransactionsByGlobalUserId(
    globalUserId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Transaction[]> {
    const { limit = 50, offset = 0 } = options;

    const rows = await db.runSystemQuery<TransactionRow>({
      text: `
        SELECT transaction_id, tenant_id, from_account, to_account,
               from_global_user_id, to_global_user_id,
               amount, event_id, status, metadata, createdAt
        FROM transactions
        WHERE from_global_user_id = $1 OR to_global_user_id = $1
        ORDER BY createdAt DESC
        LIMIT $2 OFFSET $3
      `,
      values: [globalUserId, limit, offset],
    });

    return rows.map((r) => this.toTransaction(r));
  }
}

export const transactionService = new TransactionService();


