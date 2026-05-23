// backend/src/modules/bank/bank-ledger.types.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Tipos para ledger do Unify Bank

import type { MoneyCents, PositiveMoneyCents } from '@contracts/marketplace/canonical';

/**
 * Tipo de entrada no ledger (double-entry)
 */
export type BankLedgerEntryType = 'credit' | 'debit';

/**
 * Entrada no ledger (imutável, append-only)
 */
export interface BankLedgerEntry {
  entryId: string;
  tenantId: string;
  accountId: string;
  transactionId: string;
  entryType: BankLedgerEntryType;
  amountCents: PositiveMoneyCents;
  balanceBeforeCents: MoneyCents;
  balanceAfterCents: MoneyCents;
  description?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para criar entrada no ledger
 */
export interface CreateBankLedgerEntryInput {
  accountId: string;
  /** Se omitido ou null, grava NULL no PG (Genesis permite; evita FK falsa em testes/ad-hoc). */
  transactionId?: string | null;
  entryType: BankLedgerEntryType;
  amountCents: PositiveMoneyCents;
  balanceBeforeCents: MoneyCents;
  balanceAfterCents: MoneyCents;
  description?: string;
  metadata?: Record<string, any>;
  /**
   * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
   * Hard fail no código se não fornecido
   */
  authorship: import('./financial-authorship.types').FinancialAuthorshipContext;
}

/**
 * Opções de busca de entradas do ledger
 */
export interface BankLedgerSearchOptions {
  accountId?: string;
  transactionId?: string;
  entryType?: BankLedgerEntryType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Resumo de saldo de uma conta (calculado do ledger)
 */
export interface BankAccountBalance {
  accountId: string;
  balanceCents: MoneyCents;
  totalCreditsCents: MoneyCents;
  totalDebitsCents: MoneyCents;
  entryCount: number;
  lastEntryAt?: Date | null;
}









