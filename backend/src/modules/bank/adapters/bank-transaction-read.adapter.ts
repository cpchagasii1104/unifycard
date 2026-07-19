// src/modules/bank/adapters/bank-transaction-read.adapter.ts
/**
 * Adapter: Bank Transaction Read Service
 *
 * Implementa interface do core usando repository real do module.
 */

import type {
  BankTransactionReadPort,
  WalletSummary,
  RecentTransaction,
} from '@core/bank/ports';
import { bankTransactionReadRepository } from '../bank-transaction-read.repository';
import { asMoneyCents } from '@contracts/marketplace/canonical';

export class BankTransactionReadAdapter implements BankTransactionReadPort {
  async getWalletSummaryByActorId(
    tenantId: string,
    actorId: string
  ): Promise<WalletSummary | null> {
    const summary = await bankTransactionReadRepository.getWalletSummaryByActorId(
      tenantId,
      actorId
    );

    if (!summary) {
      return null;
    }

    return {
      actorId,
      balanceCents: asMoneyCents(summary.balanceCents),
      currency: summary.currency as any,
      accountsCount: summary.accountsCount,
    };
  }

  async listRecentTransactionsByActorId(
    tenantId: string,
    actorId: string,
    opts?: { limit?: number }
  ): Promise<RecentTransaction[]> {
    const entries = await bankTransactionReadRepository.listRecentTransactionsByActorId(
      tenantId,
      actorId,
      opts
    );

    return entries.map(e => ({
      entryId: e.entryId,
      accountId: e.accountId,
      direction: e.direction,
      amountCents: asMoneyCents(e.amountCents),
      createdAt: e.createdAt,
    }));
  }

  async getMetadataByTransactionIds(
    tenantId: string,
    transactionIds: string[]
  ): Promise<Map<string, Record<string, unknown>>> {
    return bankTransactionReadRepository.getMetadataByTransactionIds(tenantId, transactionIds);
  }

  /** DECISION-0189 (F3): origem da transação + dono (autorização por recurso dos splits). */
  async getOriginAccountByTransactionId(
    tenantId: string,
    transactionId: string
  ): Promise<{ accountId: string; ownerType: string; ownerId: string } | null> {
    return bankTransactionReadRepository.getOriginAccountByTransactionId(tenantId, transactionId);
  }
}

export const bankTransactionReadAdapter = new BankTransactionReadAdapter();
