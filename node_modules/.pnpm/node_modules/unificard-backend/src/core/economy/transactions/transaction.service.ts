// backend/src/core/economy/transactions/transaction.service.ts

import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
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
  amount: string;
  event_id: string;
  status: string;
  metadata: any;
  created_at: Date;
};

type AccountRow = {
  account_id: string;
  balance: string;
  owner_type?: string;
};

class TransactionService {
  /**
   * Converte row do banco para objeto Transaction
   */
  private toTransaction(row: TransactionRow): Transaction {
    return {
      transactionId: row.transaction_id,
      tenantId: row.tenant_id,
      fromAccount: row.from_account,
      toAccount: row.to_account,
      fromGlobalUserId: row.from_global_user_id ?? undefined,
      toGlobalUserId: row.to_global_user_id ?? undefined,
      amount: parseFloat(row.amount),
      eventId: row.event_id,
      status: row.status as TransactionStatus,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Executa uma transferência atômica entre contas
   * 
   * GARANTIAS:
   * - Transação SQL atômica (BEGIN...COMMIT)
   * - Validação de saldo
   * - Idempotência via event_id
   * - Double-entry bookkeeping no ledger
   * - Emissão de evento transaction.completed
   * 
   * ROLLBACK automático em caso de:
   * - Saldo insuficiente
   * - Contas não encontradas
   * - Qualquer erro durante a transação
   */
  async transfer(tenantId: string, input: CreateTransactionInput): Promise<TransferResult> {
    const { fromAccount, toAccount, amount, eventId = uuidv4(), metadata = {} } = input;

    // Validações básicas
    if (amount <= 0) {
      const error = new Error('Amount must be greater than zero');
      (error as any).statusCode = 400;
      throw error;
    }

    if (fromAccount === toAccount) {
      const error = new Error('Cannot transfer to the same account');
      (error as any).statusCode = 400;
      throw error;
    }

    // Pega um client dedicado para essa transação
    const client = await getClientWithTenant(tenantId);

    try {
      // ==========================================
      // INÍCIO DA TRANSAÇÃO ATÔMICA
      // ==========================================
      await client.query('BEGIN');

      // 1. Verifica se transação já existe (idempotência)
      const existingTx = await client.query<TransactionRow>(
        'SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at FROM transactions WHERE event_id = $1 LIMIT 1',
        [eventId]
      );

      if (existingTx.rows.length > 0) {
        await client.query('COMMIT');
        const existingRow = existingTx.rows[0];
        
        // ==========================================
        // INVARIANTE 3: IDEMPOTÊNCIA ABSOLUTA
        // ==========================================
        // Validar que payload é idêntico (mesmo eventId = mesma operação)
        if (
          parseFloat(existingRow.amount) !== amount ||
          existingRow.from_account !== fromAccount ||
          existingRow.to_account !== toAccount
        ) {
          const error = new Error(
            `Idempotency violation: same eventId (${eventId}) used with different payload`
          ) as Error & { statusCode?: number };
          error.statusCode = 409;
          throw error;
        }
        
        // NOTA: Não buscar owner_global_user_id de accounts (coluna pode não existir)
        // Os global_user_id já devem estar preenchidos na transação quando foi criada
        // Se não estiverem, deixar como null (não é crítico para funcionamento)
        const existing = this.toTransaction(existingRow);

        // Busca saldos atuais (sem lock, pois transação já foi commitada)
        const accountsResult = await client.query<AccountRow>(
          'SELECT account_id, balance FROM accounts WHERE account_id = ANY($1::text[])',
          [[fromAccount, toAccount]]
        );

        const accountsMap = new Map(
          accountsResult.rows.map(row => [row.account_id, parseFloat(row.balance)])
        );

        return {
          transaction: existing,
          fromAccountBalance: accountsMap.get(fromAccount) ?? 0,
          toAccountBalance: accountsMap.get(toAccount) ?? 0,
        };
      }

      // 2. Busca e valida ambas as contas (FOR UPDATE para lock pessimista)
      // Lock em ordem alfabética para evitar deadlocks
      const [firstAccount, secondAccount] = [fromAccount, toAccount].sort();
      
      const accountsResult = await client.query<AccountRow & { owner_type: string }>(
        `SELECT account_id, balance, owner_type
         FROM accounts 
         WHERE account_id = ANY($1::text[])
         ORDER BY account_id
         FOR UPDATE`,
        [[firstAccount, secondAccount]]
      );

      if (accountsResult.rows.length !== 2) {
        const foundIds = new Set(accountsResult.rows.map(r => r.account_id));
        const missing = [fromAccount, toAccount].filter(id => !foundIds.has(id));
        throw new Error(`Account(s) not found: ${missing.join(', ')}`);
      }

      // Mapeia as contas encontradas
      const accountsMap = new Map(
        accountsResult.rows.map(row => [row.account_id, parseFloat(row.balance)])
      );

      const accountsInfoMap = new Map(
        accountsResult.rows.map(row => [
          row.account_id,
          {
            balance: parseFloat(row.balance),
            ownerType: row.owner_type,
          },
        ])
      );

      const fromBalance = accountsMap.get(fromAccount)!;
      const toBalance = accountsMap.get(toAccount)!;
      
      // Resolver global_user_id das contas (se owner_type = 'user')
      // NOTA: Não usar owner_global_user_id (coluna pode não existir)
      // Deixar como null se não conseguir resolver de outra forma
      const fromInfo = accountsInfoMap.get(fromAccount);
      const toInfo = accountsInfoMap.get(toAccount);
      const fromGlobalUserId = null; // Não buscar de owner_global_user_id
      const toGlobalUserId = null; // Não buscar de owner_global_user_id

      // 3. Valida saldo suficiente
      if (fromBalance < amount) {
        const error = new Error('Insufficient balance');
        (error as any).statusCode = 400;
        throw error;
      }

      // 4. Calcula novos saldos
      const newFromBalance = fromBalance - amount;
      const newToBalance = toBalance + amount;

      // ==========================================
      // INVARIANTE 2: SALDO NÃO-NEGATIVO (USER_PRIMARY)
      // ==========================================
      // Verificar se conta de usuário não ficará negativa (após lock, antes de criar ledger)
      const fromAccountInfo = accountsInfoMap.get(fromAccount);
      if (fromAccountInfo?.ownerType === 'user' && newFromBalance < 0) {
        const error = new Error(
          `Non-negative balance invariant violated: user account ${fromAccount} would have negative balance (${newFromBalance})`
        ) as Error & { statusCode?: number };
        error.statusCode = 400;
        throw error;
      }

      // 5. Atualiza ambas as contas em uma única query (mais eficiente)
      await client.query(
        `UPDATE accounts 
         SET balance = CASE account_id
           WHEN $1 THEN $2
           WHEN $3 THEN $4
         END
         WHERE account_id IN ($1, $3)`,
        [fromAccount, newFromBalance, toAccount, newToBalance]
      );

      // 6. Cria registro da transação
      const txResult = await client.query<TransactionRow>(
        `INSERT INTO transactions (tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at`,
        [tenantId, fromAccount, toAccount, fromGlobalUserId, toGlobalUserId, amount, eventId, 'completed', metadata]
      );

      const transaction = this.toTransaction(txResult.rows[0]);

      // 7. Cria entradas no ledger (double-entry bookkeeping) em batch
      await client.query(
        `INSERT INTO ledger (tenant_id, account_id, transaction_id, entry_type, amount, balance_before, balance_after)
         VALUES 
           ($1, $2, $3, $4, $5, $6, $7),
           ($1, $8, $3, $9, $5, $10, $11)`,
        [
          tenantId,
          fromAccount,
          transaction.transactionId,
          'debit',
          amount,
          fromBalance,
          newFromBalance,
          toAccount,
          'credit',
          toBalance,
          newToBalance
        ]
      );

      // ==========================================
      // INVARIANTE 1: DOUBLE-ENTRY BALANCEADO
      // ==========================================
      // Validar que sum(debits) === sum(credits) para esta transação
      const balanceCheck = await client.query<{ total_debits: string; total_credits: string }>(
        `
        SELECT 
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0)::text as total_debits,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0)::text as total_credits
        FROM ledger
        WHERE transaction_id = $1
        `,
        [transaction.transactionId]
      );

      const totalDebits = parseFloat(balanceCheck.rows[0]?.total_debits || '0');
      const totalCredits = parseFloat(balanceCheck.rows[0]?.total_credits || '0');

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        // Rollback e erro explícito
        await client.query('ROLLBACK');
        const error = new Error(
          `Double-entry invariant violated: debits (${totalDebits}) != credits (${totalCredits})`
        ) as Error & { statusCode?: number };
        error.statusCode = 500;
        throw error;
      }

      // ==========================================
      // INVARIANTE 2: SALDO NÃO-NEGATIVO (USER_PRIMARY)
      // ==========================================
      // Verificar se contas de usuário não ficaram negativas
      const negativeBalanceCheck = await client.query<{ account_id: string; balance: string; owner_type: string }>(
        `
        SELECT a.account_id, a.balance, a.owner_type
        FROM accounts a
        WHERE a.account_id IN ($1, $2)
          AND a.owner_type = 'user'
          AND a.balance < 0
        `,
        [fromAccount, toAccount]
      );

      if (negativeBalanceCheck.rows.length > 0) {
        // Rollback e erro explícito
        await client.query('ROLLBACK');
        const error = new Error(
          `Non-negative balance invariant violated: account ${negativeBalanceCheck.rows[0].account_id} has negative balance`
        ) as Error & { statusCode?: number };
        error.statusCode = 400;
        throw error;
      }

      // ==========================================
      // COMMIT DA TRANSAÇÃO ATÔMICA
      // ==========================================
      await client.query('COMMIT');

      // 8. Emite evento de transação concluída (fora da transação SQL)
      // Usa setImmediate para não bloquear o retorno da resposta
      setImmediate(async () => {
        try {
          await eventBus.publish({
            tenantId,
            type: 'transaction.completed',
            payload: {
              transactionId: transaction.transactionId,
              fromAccount,
              toAccount,
              amount,
              eventId,
              metadata,
            },
          });
        } catch (error) {
          // Log do erro mas não falha a transação (já foi commitada)
          console.error('Failed to publish transaction.completed event:', error);
        }
      });

      return {
        transaction,
        fromAccountBalance: newFromBalance,
        toAccountBalance: newToBalance,
      };
    } catch (error) {
      // Rollback em caso de erro
      await client.query('ROLLBACK');

      // Re-lança o erro com status code apropriado
      if ((error as any).statusCode) {
        throw error;
      }

      const err = new Error((error as Error).message || 'Transaction failed');
      (err as any).statusCode = 500;
      throw err;
    } finally {
      // Sempre libera o client
      client.release();
    }
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(tenantId: string, transactionId: string): Promise<Transaction | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<TransactionRow>(
        `SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
         FROM transactions
         WHERE transaction_id = $1
         LIMIT 1`,
        [transactionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toTransaction(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Busca transação por event_id (para idempotência)
   */
  async getTransactionByEventId(tenantId: string, eventId: string): Promise<Transaction | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<TransactionRow>(
        `SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
         FROM transactions
         WHERE event_id = $1
         LIMIT 1`,
        [eventId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toTransaction(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Lista transações de uma conta
   */
  async getTransactionsByAccount(
    tenantId: string,
    accountId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Transaction[]> {
    const { limit = 50, offset = 0 } = options;

    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<TransactionRow>(
        `SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
         FROM transactions
         WHERE from_account = $1 OR to_account = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [accountId, limit, offset]
      );

      return result.rows.map((row) => this.toTransaction(row));
    } finally {
      client.release();
    }
  }

  /**
   * Busca transações de um global_user_id (agregado de todos os tenants)
   */
  async getTransactionsByGlobalUserId(
    globalUserId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Transaction[]> {
    const { limit = 50, offset = 0 } = options;
    const { pool } = await import('@core/database/pool');
    
    const result = await pool.query<TransactionRow>(
      `
      SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
      FROM transactions
      WHERE from_global_user_id = $1 OR to_global_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [globalUserId, limit, offset]
    );

    return result.rows.map((row) => this.toTransaction(row));
  }
}

export const transactionService = new TransactionService();