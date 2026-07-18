// src/modules/bank/adapters/bank-account.adapter.ts
/**
 * Adapter: Bank Account Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { BankAccountPort, BankAccount, BankAccountBalance, BankLedgerEntryView, BankLedgerEntriesQuery } from '@core/bank/ports';
import { bankAccountService as realService } from '../bank-account.service';

export class BankAccountAdapter implements BankAccountPort {
  private toPortAccount(account: any): BankAccount {
    return {
      ...account,
      createdAt: new Date(account.createdAt),
      updatedAt: new Date(account.updatedAt),
    };
  }

  async getOrCreateAccount(tenantId: string, input: any): Promise<BankAccount> {
    const account = await realService.getOrCreateAccount(tenantId, input);
    return this.toPortAccount(account);
  }

  async getAccountByOwner(tenantId: string, ownerId: string, ownerType: any, currency?: any): Promise<BankAccount | null> {
    const account = await realService.getAccountByOwner(tenantId, ownerId, ownerType, currency);
    return account ? this.toPortAccount(account) : null;
  }

  async getBalance(tenantId: string, accountId: string): Promise<BankAccountBalance> {
    const balance = await realService.getBalance(tenantId, accountId);
    const account = await realService.getAccountById(tenantId, accountId);
    return {
      balanceCents: balance.balanceCents,
      currency: account?.currency || 'BRL',
    };
  }

  async getLedgerEntriesByAccount(
    tenantId: string,
    accountId: string,
    query: BankLedgerEntriesQuery = {}
  ): Promise<BankLedgerEntryView[]> {
    return realService.getLedgerEntriesByAccount(tenantId, accountId, query);
  }

  async getSystemAccount(tenantId: string, accountName: any, currency?: any): Promise<BankAccount> {
    const account = await realService.getSystemAccount(tenantId, accountName, currency);
    if (!account) {
      throw new Error(`System account ${accountName} not found`);
    }
    return this.toPortAccount(account);
  }
}

export const bankAccountAdapter = new BankAccountAdapter();





