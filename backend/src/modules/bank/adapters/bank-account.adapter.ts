// src/modules/bank/adapters/bank-account.adapter.ts
/**
 * Adapter: Bank Account Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { BankAccountPort } from '@core/bank/ports';
import { bankAccountService as realService } from '../bank-account.service';

export class BankAccountAdapter implements BankAccountPort {
  async getOrCreateAccount(tenantId: string, input: any) {
    return realService.getOrCreateAccount(tenantId, input);
  }

  async getAccountByOwner(tenantId: string, ownerId: string, ownerType: any, currency?: any) {
    return realService.getAccountByOwner(tenantId, ownerId, ownerType, currency);
  }

  async getBalance(tenantId: string, accountId: string) {
    return realService.getBalance(tenantId, accountId);
  }

  async getSystemAccount(tenantId: string, accountName: any, currency?: any) {
    return realService.getSystemAccount(tenantId, accountName, currency);
  }
}

export const bankAccountAdapter = new BankAccountAdapter();





