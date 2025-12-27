"use strict";
// backend/src/core/economy/accounts/account.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountService = void 0;
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
class AccountService {
    /**
     * Converte row do banco para objeto Account
     */
    toAccount(row) {
        return {
            accountId: row.account_id,
            tenantId: row.tenant_id,
            ownerId: row.owner_id,
            ownerType: row.owner_type,
            ownerGlobalUserId: row.owner_global_user_id ?? undefined,
            balance: parseFloat(row.balance),
            currency: row.currency,
            createdAt: row.created_at,
        };
    }
    /**
     * Busca conta específica por ID
     */
    async getAccountById(tenantId, accountId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE account_id = $1
      LIMIT 1
      `, [accountId]);
        return row ? this.toAccount(row) : null;
    }
    /**
     * Busca todas as contas de um owner
     */
    async getAccountsByOwner(tenantId, ownerId, ownerType) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = $2
      ORDER BY created_at DESC
      `, [ownerId, ownerType]);
        return rows.map((r) => this.toAccount(r));
    }
    /**
     * Busca OU cria a conta primária de um usuário
     */
    async getOrCreateUserPrimaryAccount(tenantId, userId, currency = 'BRL') {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = 'user' AND currency = $2
      LIMIT 1
      `, [userId, currency]);
        if (rows.length > 0) {
            return this.toAccount(rows[0]);
        }
        // Criar conta (sem owner_global_user_id para compatibilidade)
        const created = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
      VALUES ($1, $2, 'user', 0, $3)
      RETURNING account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      `, [tenantId, userId, currency]);
        if (!created) {
            throw new Error('Failed to create user financial account');
        }
        const account = this.toAccount(created);
        await event_bus_1.eventBus.publish({
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
    async createAccount(tenantId, input) {
        const { ownerId, ownerType, currency = 'BRL' } = input;
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = $2 AND currency = $3
      LIMIT 1
      `, [ownerId, ownerType, currency]);
        if (existing) {
            const error = new Error('Account already exists for this owner and currency');
            error.statusCode = 409;
            throw error;
        }
        // Criar conta (sem owner_global_user_id para compatibilidade)
        const created = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
      VALUES ($1, $2, $3, 0, $4)
      RETURNING account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      `, [tenantId, ownerId, ownerType, currency]);
        if (!created) {
            throw new Error('Failed to create account');
        }
        const account = this.toAccount(created);
        await event_bus_1.eventBus.publish({
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
    async listAccounts(tenantId, options = {}) {
        const { limit = 50, offset = 0, ownerType } = options;
        let sql = `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
    `;
        const params = [];
        if (ownerType) {
            sql += ` WHERE owner_type = $1`;
            params.push(ownerType);
        }
        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, sql, params);
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, ownerType
            ? `SELECT COUNT(*) AS total FROM accounts WHERE owner_type = $1`
            : `SELECT COUNT(*) AS total FROM accounts`, ownerType ? [ownerType] : []);
        return {
            accounts: rows.map((r) => this.toAccount(r)),
            total: countRow ? Number(countRow.total) : 0,
        };
    }
    /**
     * Verifica se uma conta existe
     */
    async accountExists(tenantId, accountId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT account_id FROM accounts WHERE account_id = $1 LIMIT 1`, [accountId]);
        return !!result;
    }
    /**
     * Contas de sistema (platform_ops, community_fund)
     */
    async getOrCreateSystemAccount(tenantId, ownerType, currency = 'BRL') {
        const systemOwnerId = `system-${ownerType}`;
        const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = $2 AND currency = $3
      LIMIT 1
      `, [systemOwnerId, ownerType, currency]);
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
    async getBalance(tenantId, accountId) {
        const account = await this.getAccountById(tenantId, accountId);
        if (!account) {
            throw new Error('Account not found');
        }
        return account.balance;
    }
    /**
     * Busca conta primária de um usuário
     */
    async getUserAccount(tenantId, userId, currency = 'BRL') {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT account_id, tenant_id, owner_id, owner_type, balance, currency, created_at
      FROM accounts
      WHERE owner_id = $1 AND owner_type = 'user' AND currency = $2
      LIMIT 1
      `, [userId, currency]);
        return rows.length > 0 ? this.toAccount(rows[0]) : null;
    }
    /**
     * Busca conta da plataforma
     */
    async getPlatformAccount(tenantId, currency = 'BRL') {
        return this.getOrCreateSystemAccount(tenantId, 'platform_ops', currency);
    }
    /**
     * Busca conta do fundo comunitário
     */
    async getCommunityFundAccount(tenantId, currency = 'BRL') {
        return this.getOrCreateSystemAccount(tenantId, 'community_fund', currency);
    }
    /**
     * Busca todas as contas de um global_user_id (agregado de todos os tenants)
     * NOTA: Este método requer owner_global_user_id que pode não existir.
     * Para compatibilidade, retorna array vazio se a coluna não existir.
     * Use getAccountsByOwner com userId resolvido como alternativa.
     */
    async getAccountsByGlobalUserId(globalUserId) {
        // Este método depende de owner_global_user_id que pode não existir
        // Retornar array vazio para compatibilidade
        // Em produção, use getAccountsByOwner com userId resolvido
        return [];
    }
    /**
     * Busca conta primária de um global_user_id em uma moeda específica
     */
    async getPrimaryAccountByGlobalUserId(globalUserId, currency = 'BRL') {
        const accounts = await this.getAccountsByGlobalUserId(globalUserId);
        return accounts.find((acc) => acc.currency === currency) || null;
    }
}
exports.accountService = new AccountService();
//# sourceMappingURL=account.service.js.map