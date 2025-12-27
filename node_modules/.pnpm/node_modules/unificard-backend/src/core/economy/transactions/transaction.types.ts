// backend/src/core/economy/transactions/transaction.types.ts

/**
 * Status de uma transação
 */
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

/**
 * Interface de transação financeira
 */
export interface Transaction {
  transactionId: string;
  tenantId: string;
  fromAccount: string;
  toAccount: string;
  fromGlobalUserId?: string | null;
  toGlobalUserId?: string | null;
  amount: number;
  eventId: string;
  status: TransactionStatus;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Input para criar uma transação
 */
export interface CreateTransactionInput {
  fromAccount: string;
  toAccount: string;
  amount: number;
  eventId?: string; // Para idempotência
  metadata?: Record<string, any>;
}

/**
 * Resultado de uma transferência
 */
export interface TransferResult {
  transaction: Transaction;
  fromAccountBalance: number;
  toAccountBalance: number;
}