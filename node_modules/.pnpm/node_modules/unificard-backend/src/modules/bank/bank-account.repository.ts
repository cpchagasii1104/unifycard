// backend/src/modules/bank/bank-account.repository.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Repository para contas do Unify Bank

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  BankAccount,
  CreateBankAccountInput,
  BankAccountSearchOptions,
  BankAccountOwnerType,
  BankCurrency,
} from './bank-account.types';

interface BankAccountRow {
  account_id: string;
  tenant_id: string;
  owner_id: string;
  owner_type: string;
  currency: string;
  cached_balance: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class BankAccountRepository {
  /**
   * Converte row do banco para objeto BankAccount
   */
  private toBankAccount(row: BankAccountRow): BankAccount {
    return {
      accountId: row.account_id,
      tenantId: row.tenant_id,
      ownerId: row.owner_id,
      ownerType: row.owner_type as BankAccountOwnerType,
      currency: row.currency as BankCurrency,
      cachedBalance: parseFloat(row.cached_balance),
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Busca conta por ID
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   * - Nenhuma query pode usar apenas account_id isolado
   */
  async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<BankAccount | null> {
    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, currency,
             cached_balance, metadata, createdAt, updatedAt
      FROM bank_accounts
      WHERE tenant_id = $1 AND account_id = $2
      LIMIT 1
      `,
      [tenantId, accountId]
    );

    return row ? this.toBankAccount(row) : null;
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
    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, currency,
             cached_balance, metadata, createdAt, updatedAt
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_id = $2
        AND owner_type = $3
        AND currency = $4
      LIMIT 1
      `,
      [tenantId, ownerId, ownerType, currency]
    );

    return row ? this.toBankAccount(row) : null;
  }

  /**
   * Busca contas com filtros
   */
  async searchAccounts(
    tenantId: string,
    options: BankAccountSearchOptions = {}
  ): Promise<BankAccount[]> {
    const {
      ownerId,
      ownerType,
      currency,
      limit = 100,
      offset = 0,
    } = options;

    let query = `
      SELECT account_id, tenant_id, owner_id, owner_type, currency,
             cached_balance, metadata, createdAt, updatedAt
      FROM bank_accounts
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (ownerId) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (ownerType) {
      query += ` AND owner_type = $${paramIndex}`;
      params.push(ownerType);
      paramIndex++;
    }

    if (currency) {
      query += ` AND currency = $${paramIndex}`;
      params.push(currency);
      paramIndex++;
    }

    query += ` ORDER BY createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<BankAccountRow>(
      tenantId,
      query,
      params
    );

    return rows.map((row) => this.toBankAccount(row));
  }

  /**
   * Cria uma nova conta
   */
  async createAccount(
    tenantId: string,
    input: CreateBankAccountInput
  ): Promise<BankAccount> {
    const { ownerId, ownerType, currency = 'BRL', metadata } = input;

    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      INSERT INTO bank_accounts (
        tenant_id, owner_id, owner_type, currency,
        cached_balance, metadata
      )
      VALUES ($1, $2, $3, $4, 0, $5)
      RETURNING account_id, tenant_id, owner_id, owner_type, currency,
                cached_balance, metadata, createdAt, updatedAt
      `,
      [tenantId, ownerId, ownerType, currency, metadata ? JSON.stringify(metadata) : null]
    );

    if (!row) {
      throw new Error('Failed to create bank account');
    }

    return this.toBankAccount(row);
  }

  /**
   * Atualiza cached_balance (apenas cache, não fonte da verdade)
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   */
  async updateCachedBalance(
    tenantId: string,
    accountId: string,
    balance: number
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE bank_accounts
      SET cached_balance = $1, updatedAt = NOW()
      WHERE tenant_id = $2 AND account_id = $3
      `,
      [balance, tenantId, accountId]
    );
  }

  /**
   * Busca conta do sistema por nome
   */
  async getSystemAccount(
    tenantId: string,
    accountName: 'fee' | 'regional_fund' | 'reserve' | 'escrow',
    currency: BankCurrency = 'BRL'
  ): Promise<BankAccount | null> {
    // Gerar UUID determinístico para owner_id
    // Mesmo algoritmo da migration 134: 'system:{account_name}:{tenant_id}'
    const ownerIdString = `system:${accountName}:${tenantId}`;
    
    // Usar função SQL para gerar UUID determinístico
    const row = await runQueryWithTenant<BankAccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, currency,
             cached_balance, metadata, createdAt, updatedAt
      FROM bank_accounts
      WHERE tenant_id = $1
        AND owner_id = uuid_from_string($2)
        AND owner_type = 'system'
        AND currency = $3
      LIMIT 1
      `,
      [tenantId, ownerIdString, currency]
    );

    return row ? this.toBankAccount(row) : null;
  }
}

export const bankAccountRepository = new BankAccountRepository();









