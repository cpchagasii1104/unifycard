// backend/src/modules/bank/bank-ledger.repository.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Repository para ledger do Unify Bank (append-only)

import { getClientWithTenant } from '@core/database/pool';
import type {
  BankLedgerEntry,
  CreateBankLedgerEntryInput,
  BankLedgerSearchOptions,
  BankAccountBalance,
} from './bank-ledger.types';
import type { FinancialAuthorshipContext } from './financial-authorship.types';

interface BankLedgerRow {
  entry_id: string;
  tenant_id: string;
  account_id: string;
  transaction_id: string;
  entry_type: string;
  amountCents: string;
  balance_before: string;
  balance_after: string;
  description: string | null;
  metadata: any;
  createdAt: Date;
}

class BankLedgerRepository {
  /**
   * Converte row do banco para objeto BankLedgerEntry
   */
  private toLedgerEntry(row: BankLedgerRow): BankLedgerEntry {
    return {
      entryId: row.entry_id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      transactionId: row.transaction_id,
      entryType: row.entry_type as 'credit' | 'debit',
      amountCents: parseFloat(row.amount),
      balanceBefore: parseFloat(row.balance_before),
      balanceAfter: parseFloat(row.balance_after),
      description: row.description,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Cria uma entrada no ledger (append-only)
   * 
   * REGRA ARQUITETURAL: Ledger é imutável.
   * Esta é a única operação de escrita permitida.
   * 
   * 🔴 HARD FAIL: authorship é obrigatório (exceto jobs internos/system com authoritySource='system')
   */
  async createEntry(
    tenantId: string,
    input: CreateBankLedgerEntryInput
  ): Promise<BankLedgerEntry> {
    const {
      accountId,
      transactionId,
      entryType,
      amount,
      balanceBefore,
      balanceAfter,
      description,
      metadata,
      authorship,
    } = input;

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createEntryWithAuthorship(tenantId, input, authorship);
  }

  /**
   * Cria entrada no ledger com autoria (método interno)
   */
  private async createEntryWithAuthorship(
    tenantId: string,
    input: CreateBankLedgerEntryInput,
    authorship: FinancialAuthorshipContext
  ): Promise<BankLedgerEntry> {
    const {
      accountId,
      transactionId,
      entryType,
      amount,
      balanceBefore,
      balanceAfter,
      description,
      metadata,
    } = input;

    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankLedgerRow>(
        `
        INSERT INTO bank_ledger (
          tenant_id, account_id, transaction_id, entry_type,
          amount, balance_before, balance_after,
          description, metadata,
          performed_by_user_id, acting_for_actor_id, acting_for_account_id,
          authority_source, permission_snapshot, policy_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING entry_id, tenant_id, account_id, transaction_id, entry_type,
                  amount, balance_before, balance_after,
                  description, metadata, createdAt
        `,
        [
          tenantId,
          accountId,
          transactionId,
          entryType,
          amount,
          balanceBefore,
          balanceAfter,
          description || null,
          metadata ? JSON.stringify(metadata) : null,
          authorship.performedByUserId,
          authorship.actingForActorId,
          authorship.actingForAccountId || null,
          authorship.authoritySource,
          authorship.permissionSnapshot ? JSON.stringify(authorship.permissionSnapshot) : null,
          authorship.policySnapshot ? JSON.stringify(authorship.policySnapshot) : null,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to create ledger entry');
      }

      return this.toLedgerEntry(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Busca entradas do ledger de uma conta
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   */
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
        SELECT entry_id, tenant_id, account_id, transaction_id, entry_type,
               amount, balance_before, balance_after,
               description, metadata, createdAt
        FROM bank_ledger
        WHERE tenant_id = $1 AND account_id = $2
      `;

      const params: any[] = [tenantId, accountId];
      let paramIndex = 3;

      if (entryType) {
        query += ` AND entry_type = $${paramIndex}`;
        params.push(entryType);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND createdAt >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND createdAt <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query<BankLedgerRow>(query, params);

      return result.rows.map((row) => this.toLedgerEntry(row));
    } finally {
      client.release();
    }
  }

  /**
   * Busca entradas por transação
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   */
  async getEntriesByTransaction(
    tenantId: string,
    transactionId: string
  ): Promise<BankLedgerEntry[]> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankLedgerRow>(
        `
        SELECT entry_id, tenant_id, account_id, transaction_id, entry_type,
               amount, balance_before, balance_after,
               description, metadata, createdAt
        FROM bank_ledger
        WHERE tenant_id = $1 AND transaction_id = $2
        ORDER BY entry_type DESC, createdAt ASC
        `,
        [tenantId, transactionId]
      );

      return result.rows.map((row) => this.toLedgerEntry(row));
    } finally {
      client.release();
    }
  }

  /**
   * Calcula saldo da conta a partir do ledger (FONTE DA VERDADE)
   * 
   * REGRA ARQUITETURAL: Saldo é SEMPRE calculado do ledger.
   * cached_balance é apenas cache para performance.
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   */
  async calculateBalance(
    tenantId: string,
    accountId: string
  ): Promise<BankAccountBalance> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<{
        balance: string;
        total_credits: string;
        total_debits: string;
        entry_count: string;
        last_entryAt: Date | null;
      }>(
        `
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN entry_type = 'credit' THEN amount
              WHEN entry_type = 'debit' THEN -amount
              ELSE 0
            END
          ), 0) as balance,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
          COUNT(*)::bigint as entry_count,
          MAX(createdAt) as last_entryAt
        FROM bank_ledger
        WHERE tenant_id = $1 AND account_id = $2
        `,
        [tenantId, accountId]
      );

      if (result.rows.length === 0) {
        return {
          accountId,
          balance: 0,
          totalCredits: 0,
          totalDebits: 0,
          entryCount: 0,
          lastEntryAt: null,
        };
      }

      const row = result.rows[0];

      return {
        accountId,
        balance: parseFloat(row.balance),
        totalCredits: parseFloat(row.total_credits),
        totalDebits: parseFloat(row.total_debits),
        entryCount: parseInt(row.entry_count, 10),
        lastEntryAt: row.last_entryAt,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Busca última entrada do ledger de uma conta
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   */
  async getLastEntry(
    tenantId: string,
    accountId: string
  ): Promise<BankLedgerEntry | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankLedgerRow>(
        `
        SELECT entry_id, tenant_id, account_id, transaction_id, entry_type,
               amount, balance_before, balance_after,
               description, metadata, createdAt
        FROM bank_ledger
        WHERE tenant_id = $1 AND account_id = $2
        ORDER BY createdAt DESC, entry_id DESC
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
}

export const bankLedgerRepository = new BankLedgerRepository();










