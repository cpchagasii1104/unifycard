// backend/src/core/economy/ledger/ledger.types.ts

/**
 * Tipo de entrada contábil (double-entry bookkeeping)
 */
export type EntryType = 'credit' | 'debit';

/**
 * Interface de entrada no ledger (livro contábil)
 */
export interface LedgerEntry {
  entryId: string;
  tenantId: string;
  accountId: string;
  transactionId: string;
  entryType: EntryType;
  amountCents: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

/**
 * Sumário de movimentação de uma conta
 */
export interface AccountSummary {
  accountId: string;
  totalCredits: number;
  totalDebits: number;
  netBalance: number;
  transactionCount: number;
}

/**
 * Opções para busca de entradas
 */
export interface LedgerSearchOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  entryType?: EntryType;
}

