// src/core/bank/ports/bank-account.port.ts
/**
 * Port: Bank Account Service
 * 
 * Interface para service de contas bancárias.
 * Implementação real está em @modules/bank
 * 
 * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
 */

export type BankAccountOwnerType = 'user' | 'company' | 'system';
export type BankCurrency = 'BRL' | 'USD' | 'EUR' | 'TEST';
export type SystemAccountName = 'fee' | 'regional_fund' | 'reserve' | 'escrow';

export interface BankAccount {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency: BankCurrency;
  cachedBalance: number;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccountBalance {
  balance: number;
  currency: BankCurrency;
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
  
  getSystemAccount(
    tenantId: string,
    accountName: SystemAccountName,
    currency?: BankCurrency
  ): Promise<BankAccount>;
}





