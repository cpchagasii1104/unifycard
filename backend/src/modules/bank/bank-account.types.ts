// backend/src/modules/bank/bank-account.types.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Tipos para contas do Unify Bank

import type { MoneyCents } from '@contracts/marketplace/canonical';

/**
 * Tipo de owner da conta
 */
export type BankAccountOwnerType = 'user' | 'company' | 'system' | 'escrow';

/**
 * Moeda suportada pelo Unify Bank
 */
export type BankCurrency = 'BRL' | 'USD' | 'EUR' | 'TEST';

/**
 * Nome das contas do sistema
 */
export type SystemAccountName = 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'platform_ops';

/**
 * Tipos de conta do motor financeiro (lifecycle + compatibilidade).
 * Constraint no banco: migration 0024.
 */
export type BankAccountType =
  | 'credit'
  | 'user_wallet'
  | 'escrow_payments'
  | 'escrow_disputes'
  | 'seller_pending'
  | 'seller_available'
  | 'seller_payout'
  | 'platform_revenue'
  | 'platform_fees'
  | 'clearing'
  | 'bank_settlement'
  | 'adjustment'
  | 'risk_reserve';

/**
 * Conta do Unify Bank
 */
export interface BankAccount {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: BankAccountOwnerType;
  accountType: BankAccountType;
  currency: BankCurrency;
  cachedBalanceCents: MoneyCents; // Cache apenas - saldo real vem do ledger (centavos)
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  /** Genesis: actor_id da conta (para INSERT em bank_transactions quando authorship não tem UUID) */
  actorId?: string | null;
}

/**
 * Input para criar uma conta
 */
export interface CreateBankAccountInput {
  ownerId: string;
  ownerType: BankAccountOwnerType;
  /** Tipo do lifecycle; default 'credit' para compatibilidade */
  accountType?: BankAccountType;
  currency?: BankCurrency;
  metadata?: Record<string, any>;
}

/**
 * Resultado de busca de contas
 */
export interface BankAccountsSearchResult {
  accounts: BankAccount[];
  /** Contagem de contas retornadas (paginação); não é montante monetário. */
  matchingAccountCount: number;
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









