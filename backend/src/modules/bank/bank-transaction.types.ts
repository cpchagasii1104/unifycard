// backend/src/modules/bank/bank-transaction.types.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Tipos para transações do Unify Bank

import type { BankCurrency } from './bank-account.types';

/**
 * Tipo de transação
 */
export type BankTransactionType =
  | 'transfer'      // Transferência entre contas
  | 'deposit'       // Depósito
  | 'withdrawal'    // Saque
  | 'reversal'      // Reversão de transação anterior
  | 'fee'           // Taxa
  | 'split'          // Split (Sprint 2)
  | 'escrow'        // Custódia
  | 'release';      // Liberação de custódia

/**
 * Status da transação
 */
export type BankTransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';

/**
 * Transação do Unify Bank
 */
export interface BankTransaction {
  transactionId: string;
  tenantId: string;
  eventId: string; // Para idempotência
  fromAccountId?: string | null;
  toAccountId?: string | null;
  amountCents: number;
  currency: BankCurrency;
  transactionType: BankTransactionType;
  originalTransactionId?: string | null; // Para reversões
  status: BankTransactionStatus;
  description?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  settledAt?: Date | null;
}

/**
 * Input para criar uma transação
 */
export interface CreateBankTransactionInput {
  eventId: string; // Para idempotência
  fromAccountId?: string;
  toAccountId?: string;
  amountCents: number;
  currency?: BankCurrency;
  transactionType: BankTransactionType;
  originalTransactionId?: string; // Para reversões
  description?: string;
  metadata?: Record<string, any>;
  /**
   * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
   * Hard fail no código se não fornecido
   */
  authorship: import('./financial-authorship.types').FinancialAuthorshipContext;
}

/**
 * Resultado de uma transferência
 */
export interface BankTransferResult {
  transactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  currency: BankCurrency;
  fromBalance: number; // Saldo após transferência
  toBalance: number;  // Saldo após transferência
  ledgerEntries: {
    fromEntry: string; // entryId do débito
    toEntry: string;   // entryId do crédito
  };
}









