// src/modules/bank/adapters/bank-transaction.adapter.ts
/**
 * Adapter: Bank Transaction Service
 * 
 * Implementa interface do core usando service real do module.
 */

import type { BankTransactionPort } from '@core/bank/ports';
import { bankTransactionService as realService } from '../bank-transaction.service';

export class BankTransactionAdapter implements BankTransactionPort {
  async createSimpleTransaction(tenantId: string, input: any) {
    return realService.createSimpleTransaction(tenantId, input);
  }

  async createTransactionWithSplit(tenantId: string, input: any) {
    return realService.createTransactionWithSplit(tenantId, input);
  }
}

export const bankTransactionAdapter = new BankTransactionAdapter();





