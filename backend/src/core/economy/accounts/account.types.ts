// backend/src/core/economy/accounts/account.types.ts

/**
 * Tipos de owners que podem ter contas no sistema
 */
export type OwnerType = 'user' | 'merchant' | 'community_fund' | 'platform_ops' | 'group';

/**
 * Tipo de moeda suportada
 * TEST: Moeda fictícia exclusiva para testes/desenvolvimento
 */
export type Currency = 'BRL' | 'USD' | 'EUR' | 'TEST';

/**
 * Interface de conta financeira
 */
export interface Account {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: OwnerType;
  ownerGlobalUserId?: string | null;
  balanceCents: number;
  currency: Currency;
  createdAt: string;
}

/**
 * Dados necessários para criar uma conta
 */
export interface CreateAccountInput {
  ownerId?: string;
  ownerType?: OwnerType;
  currency?: Currency;
}

/**
 * Resultado da busca de contas
 */
export interface AccountsSearchResult {
  accounts: Account[];
  totalCents: number;
}

