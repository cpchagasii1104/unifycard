// src/modules/bank/adapters/bank-transaction.adapter.ts
/**
 * Adapter: Bank Transaction Service
 *
 * Implementa interface do core usando service real do module.
 * Fronteira: normaliza montantes com toPositiveMoneyCents (§4.7) antes do domínio.
 */

import type { BankTransactionPort, BankTransaction, BankSplit } from '@core/bank/ports';
import { toPositiveMoneyCents } from '@contracts/marketplace/canonical';
import { bankTransactionService as realService } from '../bank-transaction.service';

type SimpleTxIn = Parameters<BankTransactionPort['createSimpleTransaction']>[1];
type SplitTxIn = Parameters<BankTransactionPort['createTransactionWithSplit']>[1];
type RealSimpleIn = Parameters<typeof realService.createSimpleTransaction>[1];
type RealSplitIn = Parameters<typeof realService.createTransactionWithSplit>[1];

export class BankTransactionAdapter implements BankTransactionPort {
  private toPortTransaction(transaction: any): BankTransaction {
    return {
      ...transaction,
      createdAt: new Date(transaction.createdAt),
      settledAt: transaction.settledAt ? new Date(transaction.settledAt) : null,
    };
  }

  private toPortSplit(split: any): BankSplit {
    return {
      ...split,
      createdAt: new Date(split.createdAt),
    };
  }

  private normalizeSimpleInput(input: SimpleTxIn): RealSimpleIn {
    return {
      ...(input as unknown as RealSimpleIn),
      amountCents: toPositiveMoneyCents(input.amountCents),
    };
  }

  private normalizeSplitInput(input: SplitTxIn): RealSplitIn {
    return {
      ...(input as unknown as RealSplitIn),
      amountCents: toPositiveMoneyCents(input.amountCents),
    };
  }

  async createSimpleTransaction(tenantId: string, input: SimpleTxIn) {
    const result = await realService.createSimpleTransaction(tenantId, this.normalizeSimpleInput(input));
    return {
      transaction: this.toPortTransaction(result.transaction),
      ledgerEntries: result.ledgerEntries,
    };
  }

  async createTransactionWithSplit(tenantId: string, input: SplitTxIn) {
    const result = await realService.createTransactionWithSplit(
      tenantId,
      this.normalizeSplitInput(input)
    );
    return {
      transaction: this.toPortTransaction(result.transaction),
      splits: result.splits.map((split: any) => this.toPortSplit(split)),
      ledgerEntries: result.ledgerEntries,
    };
  }
}

export const bankTransactionAdapter = new BankTransactionAdapter();





