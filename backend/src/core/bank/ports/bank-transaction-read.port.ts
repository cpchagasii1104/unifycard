// src/core/bank/ports/bank-transaction-read.port.ts
/**
 * Port: Bank Transaction Read Service
 *
 * Interface para leituras de transações/ledger.
 * Implementação real está em @modules/bank
 *
 * Ver: HIPOTESES_DAS_36_HORAS_2026-05_v3.md #019.FR
 */

import type { MoneyCents } from '@contracts/marketplace/canonical';
import type { BankCurrency } from './bank-account.port';

export interface WalletSummary {
  actorId: string;
  balanceCents: MoneyCents;
  currency: BankCurrency;
  accountsCount: number;
}

export interface RecentTransaction {
  entryId: string;
  accountId: string;
  direction: 'credit' | 'debit';
  amountCents: MoneyCents;
  createdAt: Date;
}

export interface BankTransactionReadPort {
  getWalletSummaryByActorId(
    tenantId: string,
    actorId: string
  ): Promise<WalletSummary | null>;

  listRecentTransactionsByActorId(
    tenantId: string,
    actorId: string,
    opts?: { limit?: number }
  ): Promise<RecentTransaction[]>;

  /** Metadados de transação por id (batch), via domínio Bank — R-8. */
  getMetadataByTransactionIds(
    tenantId: string,
    transactionIds: string[]
  ): Promise<Map<string, Record<string, unknown>>>;

  /**
   * DECISION-0189 (F3): conta de ORIGEM da transação + dono, resolvidos server-side pelo Bank —
   * insumo da autorização por recurso de GET /bank/transaction/:id/splits (nada do cliente
   * define o objeto). Leitura pura; null quando a transação não existe no tenant.
   */
  getOriginAccountByTransactionId(
    tenantId: string,
    transactionId: string
  ): Promise<{ accountId: string; ownerType: string; ownerId: string } | null>;
}
