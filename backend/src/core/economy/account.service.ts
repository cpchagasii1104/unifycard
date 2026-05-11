// LEGACY TEMPORÁRIO — delega para bankAccountService.
// Remover após migração completa para Bank SSOT.
// Conforme SSOT_EXCLUSIVE_BANK_RULE.md

import { bankAccountService } from '@modules/bank/bank-account.service';
import { bankLedgerRepository } from '@modules/bank/bank-ledger.repository';
import type {
  BankAccount,
  BankAccountOwnerType,
  BankCurrency,
  SystemAccountName,
} from '@modules/bank/bank-account.types';
import type { BankAccountSearchOptions } from '@modules/bank/bank-account.types';

// Interface LEGACY esperada por consumidores antigos
export interface Account {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
}

export interface CreateAccountInput {
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency?: BankCurrency;
}

export interface ListAccountsOptions {
  limit?: number;
  offset?: number;
  ownerType?: BankAccountOwnerType;
}

class AccountService {
  // LEGACY: expõe saldo real calculado via ledger; cachedBalanceCents é compat pós-DECISION-0024.
  private async toLegacyAccount(bankAccount: BankAccount): Promise<Account> {
    const balance = await bankLedgerRepository.calculateBalance(
      bankAccount.tenantId,
      bankAccount.accountId
    );

    return {
      accountId: bankAccount.accountId,
      tenantId: bankAccount.tenantId,
      ownerId: bankAccount.ownerId,
      ownerType: bankAccount.ownerType,
      balanceCents: balance.balanceCents,
      currency: bankAccount.currency,
      createdAt: bankAccount.createdAt,
    };
  }

  async getOrCreateUserPrimaryAccount(
    tenantId: string,
    userId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<Account> {
    const account = await bankAccountService.getOrCreateAccount(tenantId, {
      ownerId: userId,
      ownerType: 'user',
      currency,
    });

    return this.toLegacyAccount(account);
  }

  async getOrCreateSystemAccount(
    tenantId: string,
    accountName: SystemAccountName,
    currency: BankCurrency = 'BRL'
  ): Promise<Account> {
    const account = await bankAccountService.getOrCreateAccount(tenantId, {
      ownerId: accountName,
      ownerType: 'system',
      currency,
    });

    return this.toLegacyAccount(account);
  }

  async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<Account | null> {
    const account = await bankAccountService.getAccountById(
      tenantId,
      accountId
    );

    return account ? this.toLegacyAccount(account) : null;
  }

  async getAccountsByOwner(
    tenantId: string,
    ownerId: string,
    ownerType: BankAccountOwnerType
  ): Promise<Account[]> {
    const accounts = await bankAccountService.searchAccounts(tenantId, {
      ownerId,
      ownerType,
    });

    return Promise.all(accounts.map(acc => this.toLegacyAccount(acc)));
  }

  /**
   * Lista contas por owner usando tipo legado (OwnerType).
   * Mapeia para BankAccountOwnerType internamente.
   */
  async getAccountsByOwnerWithLegacyType(
    tenantId: string,
    ownerId: string,
    ownerType: 'user' | 'merchant' | 'community_fund' | 'platform_ops' | 'group'
  ): Promise<Account[]> {
    const bankType: BankAccountOwnerType =
      ownerType === 'user' ? 'user' :
      ownerType === 'platform_ops' ? 'system' : 'company';
    return this.getAccountsByOwner(tenantId, ownerId, bankType);
  }

  async listAccounts(
    tenantId: string,
    options: ListAccountsOptions = {}
  ): Promise<Account[]> {
    const searchOpts: BankAccountSearchOptions = {
      limit: options.limit,
      offset: options.offset,
      ownerType: options.ownerType,
    };
    const accounts = await bankAccountService.searchAccounts(tenantId, searchOpts);
    return Promise.all(accounts.map(acc => this.toLegacyAccount(acc)));
  }

  /** Stub: global user id não mapeado para owner no Bank SSOT. Retorna array vazio. */
  async getAccountsByGlobalUserId(_globalUserId: string): Promise<Account[]> {
    return [];
  }

  /** Conta da plataforma (tenant); usa conta sistema 'fee'. */
  async getPlatformAccount(
    tenantId: string,
    currency: BankCurrency = 'BRL'
  ): Promise<Account> {
    const account = await bankAccountService.getOrCreateAccount(tenantId, {
      ownerId: 'fee',
      ownerType: 'system',
      currency,
    });
    return this.toLegacyAccount(account);
  }

  async createAccount(
    tenantId: string,
    input: CreateAccountInput
  ): Promise<Account> {
    const account = await bankAccountService.getOrCreateAccount(
      tenantId,
      input
    );

    return this.toLegacyAccount(account);
  }
}

export const accountService = new AccountService();
