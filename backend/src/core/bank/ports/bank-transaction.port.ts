// src/core/bank/ports/bank-transaction.port.ts
/**
 * Port: Bank Transaction Service
 * 
 * Interface para service de transações bancárias.
 * Implementação real está em @modules/bank
 */

import type { BankCurrency } from './bank-account.port';

export type BankTransactionType =
  | 'transfer'
  | 'deposit'
  | 'withdrawal'
  | 'reversal'
  | 'fee'
  | 'split'
  | 'escrow'
  | 'release';

export type BankTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export type BankTransactionContext =
  | 'service_booking'
  | 'event_ticket'
  | 'p2p_transfer'
  | 'group_contribution'
  | 'ride_payment'
  | 'deposit'
  | 'withdrawal';

export interface BankTransaction {
  transactionId: string;
  tenantId: string;
  eventId: string;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  amount: number;
  currency: BankCurrency;
  transactionType: BankTransactionType;
  originalTransactionId?: string | null;
  status: BankTransactionStatus;
  description?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  settledAt?: Date | null;
}

export interface BankSplit {
  splitId: string;
  tenantId: string;
  transactionId: string;
  targetAccountId: string;
  amount: number;
  percentage?: number | null;
  splitType: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface BankTransactionPort {
  createSimpleTransaction(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId?: string;
      toAccountId?: string;
      amount: number;
      currency?: BankCurrency;
      transactionType: BankTransactionType;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{
    transaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }>;
  
  createTransactionWithSplit(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId: string;
      amount: number;
      currency?: BankCurrency;
      context: BankTransactionContext;
      revenueShareAccountId?: string;
      fromUserId?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }>;
}





