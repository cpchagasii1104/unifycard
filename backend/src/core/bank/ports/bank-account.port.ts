// src/core/bank/ports/bank-account.port.ts
import type { MoneyCents } from '@contracts/marketplace/canonical';

/**
 * Port: Bank Account Service
 * 
 * Interface para service de contas bancárias.
 * Implementação real está em @modules/bank
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

/**
 * 🔴 2026-08-04 — alinhado ao vocabulário REAL. Esta definição não continha `'escrow'` (que o
 * banco aceita) nem `'actor'` (o único valor que o banco guarda para carteira), e divergia da
 * gêmea em `modules/bank/bank-account.types.ts`. Duas definições do mesmo tipo, ambas erradas,
 * nenhuma contendo o valor real: exatamente a forma que o tradutor escondia.
 */
export type BankAccountOwnerType = 'user' | 'company' | 'actor' | 'system' | 'escrow';
export type BankCurrency = 'BRL' | 'USD' | 'EUR' | 'TEST';
export type SystemAccountName = 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'platform_ops';

export interface BankAccount {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency: BankCurrency;
  cachedBalanceCents: MoneyCents;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccountBalance {
  balanceCents: MoneyCents;
  currency: BankCurrency;
}

/** Movimento do ledger projetado pela porta pública (extrato por conta) — R-8. */
export interface BankLedgerEntryView {
  transactionId: string;
  entryType: 'credit' | 'debit';
  amountCents: number;
  createdAt: string;
}

export interface BankLedgerEntriesQuery {
  limit?: number;
  offset?: number;
}

export interface CreateBankAccountInput {
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency?: BankCurrency;
  metadata?: Record<string, any>;
}

export interface BankAccountPort {
  getOrCreateAccount(
    tenantId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccount>;
  
  getAccountByOwner(
    tenantId: string,
    ownerId: string,
    ownerType: BankAccountOwnerType,
    currency?: BankCurrency
  ): Promise<BankAccount | null>;
  
  getBalance(
    tenantId: string,
    accountId: string
  ): Promise<BankAccountBalance>;

  /** Extrato (movimentações) de uma conta, via domínio Bank — R-8 (sem SQL direto fora do Bank). */
  getLedgerEntriesByAccount(
    tenantId: string,
    accountId: string,
    query?: BankLedgerEntriesQuery
  ): Promise<BankLedgerEntryView[]>;

  getSystemAccount(
    tenantId: string,
    accountName: SystemAccountName,
    currency?: BankCurrency
  ): Promise<BankAccount>;
}





