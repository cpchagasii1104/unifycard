// backend/src/modules/bank/bank-account.service.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Service para contas do Unify Bank

import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import type {
  BankAccount,
  CreateBankAccountInput,
  BankAccountSearchOptions,
  BankAccountOwnerType,
  BankCurrency,
  SystemAccountName,
} from './bank-account.types';
import type { BankAccountBalance } from './bank-ledger.types';

class BankAccountService {
  /**
   * Busca conta por ID
   * Saldo retornado é calculado do ledger (fonte da verdade)
   */
  async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<BankAccount | null> {
    const account = await bankAccountRepository.getAccountById(tenantId, accountId);
    
    if (!account) {
      return null;
    }

    // Calcular saldo real do ledger
    const balance = await bankLedgerRepository.calculateBalance(tenantId, accountId);
    
    // Atualizar cached_balance se diferente
    if (Math.abs(account.cachedBalance - balance.balance) > 0.01) {
      await bankAccountRepository.updateCachedBalance(tenantId, accountId, balance.balance);
      account.cachedBalance = balance.balance;
    }

    return account;
  }

  /**
   * Busca conta por owner
   */
  async getAccountByOwner(
    tenantId: string,
    ownerId: string,
    ownerType: BankAccountOwnerType,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const account = await bankAccountRepository.getAccountByOwner(
      tenantId,
      ownerId,
      ownerType,
      currency
    );

    if (!account) {
      return null;
    }

    // Calcular saldo real do ledger
    const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);
    
    // Atualizar cached_balance se diferente
    if (Math.abs(account.cachedBalance - balance.balance) > 0.01) {
      await bankAccountRepository.updateCachedBalance(tenantId, account.accountId, balance.balance);
      account.cachedBalance = balance.balance;
    }

    return account;
  }

  /**
   * Busca OU cria conta por owner
   */
  async getOrCreateAccount(
    tenantId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccount> {
    const { ownerId, ownerType, currency = 'BRL' } = input;

    // Tentar buscar conta existente
    const existing = await bankAccountRepository.getAccountByOwner(
      tenantId,
      ownerId,
      ownerType,
      currency
    );

    if (existing) {
      // Calcular saldo real do ledger
      const balance = await bankLedgerRepository.calculateBalance(tenantId, existing.accountId);
      
      // Atualizar cached_balance se diferente
      if (Math.abs(existing.cachedBalance - balance.balance) > 0.01) {
        await bankAccountRepository.updateCachedBalance(tenantId, existing.accountId, balance.balance);
        existing.cachedBalance = balance.balance;
      }

      return existing;
    }

    // Criar nova conta
    return await bankAccountRepository.createAccount(tenantId, input);
  }

  /**
   * Busca contas com filtros
   */
  async searchAccounts(
    tenantId: string,
    options: BankAccountSearchOptions = {}
  ): Promise<BankAccount[]> {
    const accounts = await bankAccountRepository.searchAccounts(tenantId, options);

    // Atualizar saldos calculados do ledger para cada conta
    for (const account of accounts) {
      const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);
      
      if (Math.abs(account.cachedBalance - balance.balance) > 0.01) {
        await bankAccountRepository.updateCachedBalance(tenantId, account.accountId, balance.balance);
        account.cachedBalance = balance.balance;
      }
    }

    return accounts;
  }

  /**
   * Calcula saldo da conta a partir do ledger (FONTE DA VERDADE)
   * 
   * REGRA ARQUITETURAL: Saldo é SEMPRE calculado do ledger.
   * Este método retorna o saldo real, não o cache.
   */
  async getBalance(
    tenantId: string,
    accountId: string
  ): Promise<BankAccountBalance> {
    return await bankLedgerRepository.calculateBalance(tenantId, accountId);
  }

  /**
   * Busca conta do sistema por nome
   */
  async getSystemAccount(
    tenantId: string,
    accountName: SystemAccountName,
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    const account = await bankAccountRepository.getSystemAccount(tenantId, accountName, currency);

    if (!account) {
      return null;
    }

    // Calcular saldo real do ledger
    const balance = await bankLedgerRepository.calculateBalance(tenantId, account.accountId);
    
    // Atualizar cached_balance se diferente
    if (Math.abs(account.cachedBalance - balance.balance) > 0.01) {
      await bankAccountRepository.updateCachedBalance(tenantId, account.accountId, balance.balance);
      account.cachedBalance = balance.balance;
    }

    return account;
  }

  /**
   * Valida que o saldo calculado do ledger bate com o cached_balance
   * 
   * REGRA ARQUITETURAL: Números sempre devem bater.
   * Este método é usado para validação e testes.
   */
  async validateBalance(
    tenantId: string,
    accountId: string
  ): Promise<{ isValid: boolean; cachedBalance: number; calculatedBalance: number; difference: number }> {
    const account = await bankAccountRepository.getAccountById(tenantId, accountId);
    
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const balance = await bankLedgerRepository.calculateBalance(tenantId, accountId);
    const difference = Math.abs(account.cachedBalance - balance.balance);

    return {
      isValid: difference < 0.01, // Tolerância de 1 centavo
      cachedBalance: account.cachedBalance,
      calculatedBalance: balance.balance,
      difference,
    };
  }
}

export const bankAccountService = new BankAccountService();








