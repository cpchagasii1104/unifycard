// backend/src/modules/bank/bank-ledger.repository.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Repository para ledger do Unify Bank (append-only)
// Alinhado ao schema Genesis 0003: id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification, created_at

import type { PoolClient } from 'pg';
import { getClientWithTenant, pool } from '@core/database/pool';
import {
  asMoneyCents,
  toNonNegativeMoneyCents,
  toPositiveMoneyCents,
} from '@contracts/marketplace/canonical';
import type {
  BankLedgerEntry,
  CreateBankLedgerEntryInput,
  BankLedgerSearchOptions,
  BankAccountBalance,
} from './bank-ledger.types';
import type { FinancialAuthorshipContext } from './financial-authorship.types';

/** Row conforme tabela bank_ledger no Genesis (0003) */
interface BankLedgerRow {
  id: string;
  tenant_id: string;
  account_id: string;
  transaction_id: string | null;
  direction: string;
  amount_cents: number;
  purpose: string | null;
  justification: string | null;
  created_at: Date;
}

class BankLedgerRepository {
  private toLedgerEntry(row: BankLedgerRow): BankLedgerEntry {
    return {
      entryId: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      transactionId: row.transaction_id ?? '',
      entryType: row.direction as 'credit' | 'debit',
      amountCents: toPositiveMoneyCents(Number(row.amount_cents)),
      balanceBeforeCents: asMoneyCents(0),
      balanceAfterCents: asMoneyCents(0),
      description: row.justification,
      metadata: null,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria uma entrada no ledger (append-only).
   * Genesis: apenas tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification.
   */
  async createEntry(
    tenantId: string,
    input: CreateBankLedgerEntryInput,
    client?: PoolClient
  ): Promise<BankLedgerEntry> {
    const {
      accountId,
      transactionId,
      entryType,
      amountCents: amountCentsInput,
      authorship,
    } = input;

    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    const amountCents = toPositiveMoneyCents(amountCentsInput);

    const clientToUse = client ?? (await getClientWithTenant(tenantId));
    const ownClient = !client;

    try {
      const result = await clientToUse.query<BankLedgerRow>(
        `
        INSERT INTO bank_ledger (
          tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification
        )
        VALUES ($1, $2, $3, $4, $5, 'execution', NULL)
        RETURNING id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification, created_at
        `,
        [tenantId, accountId, transactionId ?? null, entryType, Number(amountCents)]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to create ledger entry');
      }

      return this.toLedgerEntry(result.rows[0]);
    } finally {
      if (ownClient) {
        clientToUse.release();
      }
    }
  }

  async getEntriesByAccount(
    tenantId: string,
    accountId: string,
    options: BankLedgerSearchOptions = {}
  ): Promise<BankLedgerEntry[]> {
    const {
      entryType,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = options;

    const client = await getClientWithTenant(tenantId);

    try {
      let query = `
        SELECT id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification, created_at
        FROM bank_ledger
        WHERE tenant_id = $1 AND account_id = $2
      `;

      const params: unknown[] = [tenantId, accountId];
      let paramIndex = 3;

      if (entryType) {
        query += ` AND direction = $${paramIndex}`;
        params.push(entryType);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query<BankLedgerRow>(query, params);

      return result.rows.map((row) => this.toLedgerEntry(row));
    } finally {
      client.release();
    }
  }

  async getEntriesByTransaction(
    tenantId: string,
    transactionId: string
  ): Promise<BankLedgerEntry[]> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankLedgerRow>(
        `
        SELECT id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification, created_at
        FROM bank_ledger
        WHERE tenant_id = $1 AND transaction_id = $2
        ORDER BY direction DESC, created_at ASC
        `,
        [tenantId, transactionId]
      );

      return result.rows.map((row) => this.toLedgerEntry(row));
    } finally {
      client.release();
    }
  }

  /**
   * Calcula saldo da conta a partir do ledger.
   * @param client - Quando informado, usa a mesma conexão (mesma transação); não faz release.
   */
  async calculateBalance(
    tenantId: string,
    accountId: string,
    client?: PoolClient
  ): Promise<BankAccountBalance> {
    const clientToUse = client ?? (await getClientWithTenant(tenantId));
    const ownClient = !client;

    try {
      const result = await clientToUse.query<{
        balance_cents: string;
        total_credits_cents: string;
        total_debits_cents: string;
        entry_count: string;
        last_entry_at: Date | null;
      }>(
        `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN direction = 'credit' THEN amount_cents
              WHEN direction = 'debit' THEN -amount_cents
              ELSE 0
            END
          ), 0)::bigint as balance_cents,
          COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END), 0)::bigint as total_credits_cents,
          COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END), 0)::bigint as total_debits_cents,
          COUNT(*)::bigint as entry_count,
          MAX(created_at) as last_entry_at
        FROM bank_ledger
        WHERE tenant_id = $1 AND account_id = $2
        `,
        [tenantId, accountId]
      );

      if (result.rows.length === 0) {
        return {
          accountId,
          balanceCents: asMoneyCents(0),
          totalCreditsCents: asMoneyCents(0),
          totalDebitsCents: asMoneyCents(0),
          entryCount: 0,
          lastEntryAt: null,
        };
      }

      const row = result.rows[0];

      return {
        accountId,
        balanceCents: asMoneyCents(Number(row.balance_cents)),
        totalCreditsCents: toNonNegativeMoneyCents(Number(row.total_credits_cents)),
        totalDebitsCents: toNonNegativeMoneyCents(Number(row.total_debits_cents)),
        entryCount: parseInt(row.entry_count, 10),
        lastEntryAt: row.last_entry_at,
      };
    } finally {
      if (ownClient) {
        clientToUse.release();
      }
    }
  }

  /**
   * Reversão financeira: conta de crédito única para a transação (fallback quando counterpart ausente).
   * SQL do SSOT de lançamentos permanece no módulo Bank.
   */
  async getCreditAccountIdForReversalLedgerFallback(
    tenantId: string,
    transactionId: string,
    client: PoolClient
  ): Promise<string> {
    const result = await client.query<{ account_id: string }>(
      `
      SELECT account_id FROM bank_ledger
      WHERE tenant_id = $1 AND transaction_id = $2 AND direction = 'credit'
      `,
      [tenantId, transactionId]
    );
    if (result.rows.length === 0) {
      throw new Error('REVERSAL_COUNTERPART_UNKNOWN_MIGRATE_0052');
    }
    if (result.rows.length !== 1) {
      throw new Error('REVERSAL_AMBIGUOUS_COUNTERPART');
    }
    return result.rows[0].account_id;
  }

  /**
   * Inserção de débito em manutenção/backfill (mesma transação SQL que o caller).
   * Não substitui createEntry (autoria obrigatória no runtime).
   */
  async insertMaintenanceLedgerDebit(
    client: PoolClient,
    tenantId: string,
    accountId: string,
    transactionId: string,
    amountCents: number,
    justification: string
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO bank_ledger (
        tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification
      )
      VALUES ($1, $2, $3, 'debit', $4, 'execution', $5)
      `,
      [tenantId, accountId, transactionId, amountCents, justification]
    );
  }

  /**
   * Totais globais de débito/crédito no ledger (smoke / scripts de verificação).
   */
  async sumGlobalDebitCreditTotals(): Promise<{ debit: string; credit: string }> {
    const r = await pool.query<{ d: string; c: string }>(
      `
      SELECT
        SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END)::text AS d,
        SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END)::text AS c
      FROM bank_ledger
      `
    );
    return {
      debit: r.rows[0]?.d ?? '0',
      credit: r.rows[0]?.c ?? '0',
    };
  }

  async getLastEntry(
    tenantId: string,
    accountId: string
  ): Promise<BankLedgerEntry | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankLedgerRow>(
        `
        SELECT id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification, created_at
        FROM bank_ledger
        WHERE tenant_id = $1 AND account_id = $2
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `,
        [tenantId, accountId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.toLedgerEntry(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /** Leitura SSOT por id de linha do bank_ledger (substitui economy ledger stub em invoicing/reporting). */
  async getEntryById(tenantId: string, entryId: string): Promise<BankLedgerEntry | null> {
    const client = await getClientWithTenant(tenantId);
    try {
      const result = await client.query<BankLedgerRow>(
        `
        SELECT id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification, created_at
        FROM bank_ledger
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1
        `,
        [tenantId, entryId]
      );
      if (result.rows.length === 0) {
        return null;
      }
      return this.toLedgerEntry(result.rows[0]);
    } finally {
      client.release();
    }
  }
}

export const bankLedgerRepository = new BankLedgerRepository();

/**
 * Leitura de saldo consistente dentro de uma transação ativa.
 * Obrigatório passar client (transação já iniciada). Não abre nova conexão.
 * Usado para eliminar race conditions em operações financeiras.
 */
export async function getAccountBalanceConsistent(
  tenantId: string,
  accountId: string,
  client: PoolClient
): Promise<BankAccountBalance> {
  if (!client) {
    throw new Error('getAccountBalanceConsistent requires an active transaction client');
  }
  return bankLedgerRepository.calculateBalance(tenantId, accountId, client);
}
