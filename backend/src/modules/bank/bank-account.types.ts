// backend/src/modules/bank/bank-account.types.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Tipos para contas do Unify Bank

/**
 * Tipo de owner da conta
 */
export type BankAccountOwnerType = 'user' | 'company' | 'system';

/**
 * Moeda suportada pelo Unify Bank
 */
export type BankCurrency = 'BRL' | 'USD' | 'EUR' | 'TEST';

/**
 * Nome das contas do sistema
 */
export type SystemAccountName = 'fee' | 'regional_fund' | 'reserve' | 'escrow';

/**
 * Conta do Unify Bank
 */
export interface BankAccount {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency: BankCurrency;
  cachedBalance: number; // Cache apenas - saldo real vem do ledger
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar uma conta
 */
export interface CreateBankAccountInput {
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency?: BankCurrency;
  metadata?: Record<string, any>;
}

/**
 * Resultado de busca de contas
 */
export interface BankAccountsSearchResult {
  accounts: BankAccount[];
  total: number;
}

/**
 * Opções de busca de contas
 */
export interface BankAccountSearchOptions {
  ownerId?: string;
  ownerType?: BankAccountOwnerType;
  currency?: BankCurrency;
  limit?: number;
  offset?: number;
}







