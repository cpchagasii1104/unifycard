// backend/src/core/economy/accounts/account.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import type {
  Account,
  CreateAccountInput,
  OwnerType,
  Currency,
  AccountsSearchResult,
} from './account.types';

interface AccountRow {
  account_id: string;
  tenant_id: string;
  owner_id: string;
  owner_type: string;
  owner_global_user_id: string | null;
  balance: string;
  currency: string;
  created_at: Date;
}

interface CountRow {
  total: string;
}

class AccountService {
  /**
   * Converte row do banco para objeto Account
   */
  private toAccount(row: Partial<AccountRow> & { account_id: string; tenant_id: string; owner_id: string; owner_type: string; balance: string; currency: string; created_at: Date }): Account {
    return {
      accountId: row.account_id,
      tenantId: row.tenant_id,
      ownerId: row.owner_id,
      ownerType: row.owner_type as OwnerType,
      ownerGlobalUserId: (row as any).owner_global_user_id ?? undefined,
      balance: parseFloat(row.balance),
      currency: row.currency as Currency,
      createdAt: row.created_at,
    };
  }

  /**
   * Busca conta específica por ID
   */
  async getAccountById(
    tenantId: string,
    accountId: string
  ): Promise<Account | null> {
    const row = await runQueryWithTenant<AccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE account_id = $1
      LIMIT 1
      `,
      [accountId]
    );

    return row ? this.toAccount(row) : null;
  }

  /**
   * Busca todas as contas de um owner
   */
  async getAccountsByOwner(
    tenantId: string,
    ownerId: string,
    ownerType: OwnerType
  ): Promise<Account[]> {
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = $2
      ORDER BY created_at DESC
      `,
      [ownerId, ownerType]
    );

    return rows.map((r) => this.toAccount(r));
  }

  /**
   * Busca OU cria a conta primária de um usuário
   */
  async getOrCreateUserPrimaryAccount(
    tenantId: string,
    userId: string,
    currency: Currency = 'BRL'
  ): Promise<Account> {
    const rows = await runQueriesWithTenant<AccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = 'user' AND currency = $2
      LIMIT 1
      `,
      [userId, currency]
    );

    if (rows.length > 0) {
      return this.toAccount(rows[0]);
    }

    // Criar conta (sem owner_global_user_id para compatibilidade)
    const created = await runQueryWithTenant<any>(
      tenantId,
      `
      INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
      VALUES ($1, $2, 'user', 0, $3)
      RETURNING account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      `,
      [tenantId, userId, currency]
    );

    if (!created) {
      throw new Error('Failed to create user financial account');
    }

    const account = this.toAccount(created);

    await eventBus.publish({
      tenantId,
      type: 'account.created',
      payload: {
        accountId: account.accountId,
        ownerId: account.ownerId,
        ownerType: 'user',
        currency: account.currency,
      },
    });

    return account;
  }

  /**
   * Cria conta manualmente
   */
  async createAccount(
    tenantId: string,
    input: CreateAccountInput
  ): Promise<Account> {
    const { ownerId, ownerType, currency = 'BRL' } = input;

    const existing = await runQueryWithTenant<AccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = $2 AND currency = $3
      LIMIT 1
      `,
      [ownerId, ownerType, currency]
    );

    if (existing) {
      const error = new Error(
        'Account already exists for this owner and currency'
      ) as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    // Criar conta (sem owner_global_user_id para compatibilidade)
    const created = await runQueryWithTenant<any>(
      tenantId,
      `
      INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
      VALUES ($1, $2, $3, 0, $4)
      RETURNING account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      `,
      [tenantId, ownerId, ownerType, currency]
    );

    if (!created) {
      throw new Error('Failed to create account');
    }

    const account = this.toAccount(created);

    await eventBus.publish({
      tenantId,
      type: 'account.created',
      payload: {
        accountId: account.accountId,
        ownerId: account.ownerId,
        ownerType: account.ownerType,
        currency: account.currency,
      },
    });

    return account;
  }

  /**
   * Lista contas
   */
  async listAccounts(
    tenantId: string,
    options: { limit?: number; offset?: number; ownerType?: OwnerType } = {}
  ): Promise<AccountsSearchResult> {
    const { limit = 50, offset = 0, ownerType } = options;

    let sql = `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
    `;

    const params: unknown[] = [];

    if (ownerType) {
      sql += ` WHERE owner_type = $1`;
      params.push(ownerType);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<AccountRow>(tenantId, sql, params);

    const countRow = await runQueryWithTenant<CountRow>(
      tenantId,
      ownerType
        ? `SELECT COUNT(*) AS total FROM accounts WHERE owner_type = $1`
        : `SELECT COUNT(*) AS total FROM accounts`,
      ownerType ? [ownerType] : []
    );

    return {
      accounts: rows.map((r) => this.toAccount(r)),
      total: countRow ? Number(countRow.total) : 0,
    };
  }

  /**
   * Verifica se uma conta existe
   */
  async accountExists(tenantId: string, accountId: string): Promise<boolean> {
    const result = await runQueryWithTenant<{ account_id: string }>(
      tenantId,
      `SELECT account_id FROM accounts WHERE account_id = $1 LIMIT 1`,
      [accountId]
    );

    return !!result;
  }

  /**
   * Contas de sistema (platform_ops, community_fund)
   */
  async getOrCreateSystemAccount(
    tenantId: string,
    ownerType: 'platform_ops' | 'community_fund',
    currency: Currency = 'BRL'
  ): Promise<Account> {
    const systemOwnerId = `system-${ownerType}`;

    const existing = await runQueryWithTenant<AccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = $2 AND currency = $3
      LIMIT 1
      `,
      [systemOwnerId, ownerType, currency]
    );

    if (existing) {
      return this.toAccount(existing);
    }

    return this.createAccount(tenantId, {
      ownerId: systemOwnerId,
      ownerType,
      currency,
    });
  }

  // =====================
  // MÉTODOS AUXILIARES (para controllers e outros módulos)
  // =====================

  /**
   * Retorna o saldo de uma conta
   */
  async getBalance(tenantId: string, accountId: string): Promise<number> {
    const account = await this.getAccountById(tenantId, accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    return account.balance;
  }

  /**
   * Busca conta primária de um usuário
   */
  async getUserAccount(
    tenantId: string,
    userId: string,
    currency: Currency = 'BRL'
  ): Promise<Account | null> {
    const rows = await runQueriesWithTenant<AccountRow>(
      tenantId,
      `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = 'user' AND currency = $2
      LIMIT 1
      `,
      [userId, currency]
    );

    return rows.length > 0 ? this.toAccount(rows[0]) : null;
  }

  /**
   * Busca conta da plataforma
   */
  async getPlatformAccount(
    tenantId: string,
    currency: Currency = 'BRL'
  ): Promise<Account> {
    return this.getOrCreateSystemAccount(tenantId, 'platform_ops', currency);
  }

  /**
   * Busca conta do fundo comunitário
   */
  async getCommunityFundAccount(
    tenantId: string,
    currency: Currency = 'BRL'
  ): Promise<Account> {
    return this.getOrCreateSystemAccount(tenantId, 'community_fund', currency);
  }

  /**
   * Busca todas as contas de um global_user_id (agregado de todos os tenants)
   * NOTA: Este método requer owner_global_user_id que pode não existir.
   * Para compatibilidade, retorna array vazio se a coluna não existir.
   * Use getAccountsByOwner com userId resolvido como alternativa.
   */
  async getAccountsByGlobalUserId(globalUserId: string): Promise<Account[]> {
    // Este método depende de owner_global_user_id que pode não existir
    // Retornar array vazio para compatibilidade
    // Em produção, use getAccountsByOwner com userId resolvido
    return [];
  }

  /**
   * Busca conta primária de um global_user_id em uma moeda específica
   */
  async getPrimaryAccountByGlobalUserId(
    globalUserId: string,
    currency: Currency = 'BRL'
  ): Promise<Account | null> {
    const accounts = await this.getAccountsByGlobalUserId(globalUserId);
    return accounts.find((acc) => acc.currency === currency) || null;
  }
}

export const accountService = new AccountService();