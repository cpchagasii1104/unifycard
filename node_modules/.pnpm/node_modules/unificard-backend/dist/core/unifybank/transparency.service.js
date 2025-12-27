"use strict";
// backend/src/core/unifybank/transparency.service.ts
// Serviço de Transparência Financeira - FASE 6
// Visualização de extratos, splits e fundos regionais
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.transparencyService = void 0;
const pool_1 = require("@core/database/pool");
const account_service_1 = require("@core/economy/accounts/account.service");
const region_account_service_1 = require("@core/economy/region-account.service");
class TransparencyService {
    /**
     * Obtém extrato financeiro do usuário
     * Usa dados do ledger (não recalcula saldo)
     */
    async getUserStatement(tenantId, globalUserId, options = {}) {
        const { limit = 50, offset = 0, startDate, endDate } = options;
        // 1. Resolver conta principal do usuário
        const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
        if (!userId) {
            throw new Error('User not found');
        }
        const userAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, userId, 'BRL');
        const accountId = userAccount.accountId;
        // 2. Buscar entradas do ledger para essa conta
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            let query = `
        SELECT 
          l.entry_id,
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.balance_after,
          l.created_at,
          t.metadata as transaction_metadata
        FROM ledger l
        INNER JOIN transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1
      `;
            const params = [accountId];
            let paramIndex = 2;
            if (startDate) {
                query += ` AND l.created_at >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                query += ` AND l.created_at <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit + 1, offset); // +1 para verificar se tem mais
            const result = await client.query(query, params);
            const hasMore = result.rows.length > limit;
            const entries = result.rows.slice(0, limit).map((row) => {
                const metadata = row.transaction_metadata || {};
                const entryType = row.entry_type;
                // Determinar tipo da transação
                let type = 'other';
                if (metadata.type === 'p2p_transfer')
                    type = 'p2p';
                else if (metadata.type === 'donation')
                    type = 'donation';
                else if (metadata.type === 'split')
                    type = 'split';
                else if (metadata.type === 'compensation')
                    type = 'compensation';
                return {
                    transactionId: row.transaction_id,
                    type,
                    amount: parseFloat(row.amount),
                    direction: (entryType === 'credit' ? 'in' : 'out'),
                    balanceAfter: parseFloat(row.balance_after),
                    createdAt: row.created_at,
                    metadata: {
                        type: metadata.type,
                        targetType: metadata.targetType,
                        targetId: metadata.targetId,
                        originTransactionId: metadata.originTransactionId,
                        splitGroupId: metadata.splitGroupId,
                        message: metadata.message,
                    },
                };
            });
            return {
                entries,
                total: entries.length,
                hasMore,
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Obtém detalhe de split de uma transação base
     * Busca todas as transações que compartilham o mesmo splitGroupId
     */
    async getTransactionSplits(tenantId, transactionId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            // 1. Buscar transação base
            const baseTx = await client.query(`
        SELECT transaction_id, amount, metadata, created_at
        FROM transactions
        WHERE transaction_id = $1 AND tenant_id = $2
        LIMIT 1
        `, [transactionId, tenantId]);
            if (baseTx.rows.length === 0) {
                return null;
            }
            const base = baseTx.rows[0];
            const baseMetadata = base.metadata || {};
            const splitGroupId = baseMetadata.splitGroupId;
            // Se não tem splitGroupId, não é uma transação com split
            if (!splitGroupId) {
                return {
                    baseTransaction: {
                        transactionId: base.transaction_id,
                        amount: parseFloat(base.amount),
                        type: baseMetadata.type || 'other',
                        createdAt: base.created_at,
                        metadata: baseMetadata,
                    },
                    splits: [],
                    totalPercentage: 0,
                    totalAmount: 0,
                };
            }
            // 2. Buscar todas as transações com o mesmo splitGroupId
            const splitTxs = await client.query(`
        SELECT transaction_id, amount, metadata, created_at
        FROM transactions
        WHERE tenant_id = $1
          AND metadata->>'splitGroupId' = $2
          AND metadata->>'type' = 'split'
        ORDER BY created_at ASC
        `, [tenantId, splitGroupId]);
            const splits = splitTxs.rows.map((row) => {
                const metadata = row.metadata || {};
                return {
                    transactionId: row.transaction_id,
                    targetType: metadata.targetType,
                    targetId: metadata.targetId,
                    percentage: metadata.percentage || 0,
                    amount: parseFloat(row.amount),
                    createdAt: row.created_at,
                };
            });
            const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);
            const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);
            return {
                baseTransaction: {
                    transactionId: base.transaction_id,
                    amount: parseFloat(base.amount),
                    type: baseMetadata.type || 'other',
                    createdAt: base.created_at,
                    metadata: baseMetadata,
                },
                splits,
                totalPercentage,
                totalAmount,
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Obtém visão do fundo regional para o usuário
     */
    async getUserRegionalFund(tenantId, globalUserId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        // 1. Resolver userId do globalUserId
        const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
        if (!userId) {
            throw new Error('User not found');
        }
        // 2. Resolver conta regional
        const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
            tenantId,
            userId,
        });
        if (!regionAccountId) {
            return null; // Não há fundo regional para esse usuário
        }
        // 3. Obter saldo atual
        const balance = await account_service_1.accountService.getBalance(tenantId, regionAccountId);
        // 4. Buscar movimentações do ledger
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const ledgerEntries = await client.query(`
        SELECT l.transaction_id, l.entry_type, l.amount, l.created_at
        FROM ledger l
        WHERE l.account_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
        `, [regionAccountId, limit, offset]);
            // 5. Buscar metadados das transações
            const transactionIds = ledgerEntries.rows.map((r) => r.transaction_id);
            const transactions = transactionIds.length > 0
                ? await client.query(`
            SELECT transaction_id, metadata
            FROM transactions
            WHERE transaction_id = ANY($1::text[])
            `, [transactionIds])
                : { rows: [] };
            const txMap = new Map(transactions.rows.map((tx) => [tx.transaction_id, tx.metadata || {}]));
            const entries = ledgerEntries.rows.map((row) => {
                const metadata = txMap.get(row.transaction_id) || {};
                const entryType = row.entry_type;
                // Determinar origem
                let origin = 'other';
                if (metadata.type === 'split' && metadata.context === 'donation') {
                    origin = 'donation';
                }
                else if (metadata.type === 'split' && metadata.context === 'service') {
                    origin = 'service';
                }
                else if (metadata.type === 'split' && metadata.context === 'event') {
                    origin = 'event';
                }
                return {
                    transactionId: row.transaction_id,
                    type: entryType,
                    amount: parseFloat(row.amount),
                    origin,
                    originTransactionId: metadata.originTransactionId,
                    destination: metadata.targetId,
                    context: metadata.context,
                    createdAt: row.created_at,
                    metadata,
                };
            });
            const totalIn = entries
                .filter((e) => e.type === 'credit')
                .reduce((sum, e) => sum + e.amount, 0);
            const totalOut = entries
                .filter((e) => e.type === 'debit')
                .reduce((sum, e) => sum + e.amount, 0);
            return {
                accountId: regionAccountId,
                currentBalance: balance,
                entries,
                summary: {
                    totalIn,
                    totalOut,
                    netAmount: totalIn - totalOut,
                },
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Obtém visão administrativa do fundo regional
     */
    async getAdminRegionalFund(tenantId, regionId, options = {}) {
        const { limit = 100, offset = 0, startDate, endDate } = options;
        // 1. Resolver conta regional (usando ownerId = regionId, ownerType = 'group')
        const regionAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, regionId, 'group');
        const regionAccount = regionAccounts[0];
        if (!regionAccount) {
            return null; // Não há conta regional para essa região
        }
        const regionAccountId = regionAccount.accountId;
        // 2. Obter saldo atual
        const balance = await account_service_1.accountService.getBalance(tenantId, regionAccountId);
        // 3. Buscar todas as movimentações
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            let query = `
        SELECT 
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.created_at,
          t.metadata
        FROM ledger l
        INNER JOIN transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1
      `;
            const params = [regionAccountId];
            let paramIndex = 2;
            if (startDate) {
                query += ` AND l.created_at >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                query += ` AND l.created_at <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
            const ledgerEntries = await client.query(query, params);
            const entries = ledgerEntries.rows.map((row) => {
                const metadata = row.metadata || {};
                const entryType = row.entry_type;
                let origin = 'other';
                if (metadata.type === 'split' && metadata.context === 'donation') {
                    origin = 'donation';
                }
                else if (metadata.type === 'split' && metadata.context === 'service') {
                    origin = 'service';
                }
                else if (metadata.type === 'split' && metadata.context === 'event') {
                    origin = 'event';
                }
                return {
                    transactionId: row.transaction_id,
                    type: entryType,
                    amount: parseFloat(row.amount),
                    origin,
                    originTransactionId: metadata.originTransactionId,
                    destination: metadata.targetId,
                    context: metadata.context,
                    createdAt: row.created_at,
                    metadata,
                };
            });
            // 4. Calcular agregações
            const totalIn = entries
                .filter((e) => e.type === 'credit')
                .reduce((sum, e) => sum + e.amount, 0);
            const totalOut = entries
                .filter((e) => e.type === 'debit')
                .reduce((sum, e) => sum + e.amount, 0);
            // Agrupar por origem
            const byOrigin = {};
            entries
                .filter((e) => e.type === 'credit')
                .forEach((e) => {
                byOrigin[e.origin] = (byOrigin[e.origin] || 0) + e.amount;
            });
            // Agrupar por contexto
            const byContext = {};
            entries
                .filter((e) => e.type === 'credit')
                .forEach((e) => {
                const ctx = e.context || 'other';
                byContext[ctx] = (byContext[ctx] || 0) + e.amount;
            });
            // Agrupar por período (mensal)
            const byPeriodMap = new Map();
            entries.forEach((e) => {
                const period = e.createdAt.toISOString().substring(0, 7); // YYYY-MM
                const current = byPeriodMap.get(period) || { in: 0, out: 0 };
                if (e.type === 'credit') {
                    current.in += e.amount;
                }
                else {
                    current.out += e.amount;
                }
                byPeriodMap.set(period, current);
            });
            const byPeriod = Array.from(byPeriodMap.entries())
                .map(([period, data]) => ({
                period,
                totalIn: data.in,
                totalOut: data.out,
            }))
                .sort((a, b) => a.period.localeCompare(b.period));
            return {
                regionId,
                accountId: regionAccountId,
                currentBalance: balance,
                entries,
                summary: {
                    totalIn,
                    totalOut,
                    netAmount: totalIn - totalOut,
                    byOrigin,
                    byContext,
                    byPeriod,
                },
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Helper: obtém userId a partir de globalUserId
     */
    async getUserIdFromGlobalId(tenantId, globalUserId) {
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const result = await pool.query(`
      SELECT user_id
      FROM users
      WHERE tenant_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [tenantId, globalUserId]);
        return result.rows[0]?.user_id || null;
    }
}
exports.transparencyService = new TransparencyService();
//# sourceMappingURL=transparency.service.js.map