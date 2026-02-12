"use strict";
// backend/src/core/unifybank/transparency.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de Transparência Financeira - Visualização de extratos, splits e fundos regionais
// Usa Unify Bank (bank_transactions, bank_ledger, bank_splits) como fonte da verdade
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
const ports_registry_1 = require("@core/bank/ports-registry");
class TransparencyService {
    /**
     * Obtém extrato financeiro do usuário
     * Usa dados do bank_ledger (fonte da verdade do Unify Bank)
     */
    async getUserStatement(tenantId, globalUserId, options = {}) {
        const { limit = 50, offset = 0, startDate, endDate } = options;
        // 1. Resolver conta principal do usuário no Unify Bank
        const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
        if (!userId) {
            throw new Error('User not found');
        }
        // Verificar se conta existe no Unify Bank
        const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
        const userAccount = await bankAccount.getAccountByOwner(tenantId, userId, 'user', 'BRL');
        if (!userAccount) {
            // Sem conta bancária: retornar extrato vazio (não é erro)
            return {
                entries: [],
                totalCents: 0,
                hasMore: false,
            };
        }
        const accountId = userAccount.accountId;
        // 2. Buscar entradas do bank_ledger para essa conta
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            let query = `
        SELECT 
          l.entry_id,
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.balance_after,
          l.createdAt,
          t.metadata as transaction_metadata,
          t.status,
          t.transaction_type,
          t.original_transaction_id
        FROM bank_ledger l
        INNER JOIN bank_transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1 AND l.tenant_id = $2
      `;
            const params = [accountId, tenantId];
            let paramIndex = 3;
            if (startDate) {
                query += ` AND l.createdAt >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                query += ` AND l.createdAt <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            query += ` ORDER BY l.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit + 1, offset); // +1 para verificar se tem mais
            const result = await client.query(query, params);
            const hasMore = result.rows.length > limit;
            const entries = result.rows.slice(0, limit).map((row) => {
                const metadata = row.transaction_metadata || {};
                const entryType = row.entry_type;
                // Determinar tipo da transação (legacy para compatibilidade)
                let type = 'other';
                if (metadata.type === 'p2p_transfer')
                    type = 'p2p';
                else if (metadata.type === 'donation')
                    type = 'donation';
                else if (metadata.type === 'split')
                    type = 'split';
                else if (metadata.type === 'compensation')
                    type = 'compensation';
                // Extrair context do metadata (ou inferir do transaction_type)
                let context = metadata.context;
                if (!context) {
                    // Inferir context do metadata.type ou transaction_type
                    if (metadata.type === 'event_ticket' || metadata.type === 'event_consumption')
                        context = 'event_ticket';
                    else if (metadata.type === 'service_booking')
                        context = 'service_booking';
                    else if (metadata.type === 'ride_payment')
                        context = 'ride_payment';
                    else if (metadata.type === 'p2p_transfer')
                        context = 'p2p_transfer';
                    else if (metadata.type === 'donation')
                        context = 'donation';
                    else if (metadata.type === 'group_contribution')
                        context = 'group_contribution';
                    else if (row.transaction_type === 'deposit')
                        context = 'deposit';
                    else if (row.transaction_type === 'withdrawal')
                        context = 'withdrawal';
                }
                // Determinar status (completed ou reversed)
                const status = row.original_transaction_id ? 'reversed' : (row.status === 'completed' ? 'completed' : row.status);
                // Determinar reference_type e reference_id do metadata
                let referenceType;
                let referenceId;
                if (metadata.eventId) {
                    referenceType = 'event';
                    referenceId = metadata.eventId;
                }
                else if (metadata.bookingId) {
                    referenceType = 'booking';
                    referenceId = metadata.bookingId;
                }
                else if (metadata.rideId) {
                    referenceType = 'ride';
                    referenceId = metadata.rideId;
                }
                else if (metadata.groupId) {
                    referenceType = 'group';
                    referenceId = metadata.groupId;
                }
                else if (metadata.targetId && metadata.targetType) {
                    referenceType = metadata.targetType;
                    referenceId = metadata.targetId;
                }
                return {
                    transactionId: row.transaction_id,
                    type,
                    amountCents: parseFloat(row.amount),
                    direction: (entryType === 'credit' ? 'in' : 'out'),
                    balanceAfter: parseFloat(row.balance_after),
                    createdAt: row.createdAt,
                    context: context || 'other',
                    status: status,
                    referenceType,
                    referenceId,
                    metadata: {
                        type: metadata.type,
                        targetType: metadata.targetType,
                        targetId: metadata.targetId,
                        originTransactionId: metadata.originTransactionId,
                        splitGroupId: metadata.splitGroupId,
                        message: metadata.message,
                        context,
                        eventId: metadata.eventId,
                        bookingId: metadata.bookingId,
                        rideId: metadata.rideId,
                        groupId: metadata.groupId,
                    },
                };
            });
            return {
                entries,
                totalCents: entries.length,
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
            // 1. Buscar transação base no Unify Bank
            const baseTx = await client.query(`
        SELECT transaction_id, amount, metadata, createdAt
        FROM bank_transactions
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
                        amountCents: parseFloat(base.amount),
                        type: baseMetadata.type || 'other',
                        createdAt: base.createdAt,
                        metadata: baseMetadata,
                    },
                    splits: [],
                    totalPercentage: 0,
                    totalAmount: 0,
                };
            }
            // 2. Buscar todos os splits da transação no Unify Bank
            // No Unify Bank, splits estão na tabela bank_splits, não em transações separadas
            const splits = await client.query(`
        SELECT split_id, transaction_id, target_account_id, amount, percentage, split_type, createdAt
        FROM bank_splits
        WHERE tenant_id = $1 AND transaction_id = $2
        ORDER BY createdAt ASC
        `, [tenantId, transactionId]);
            // Buscar informações das contas de destino dos splits
            const splitAccountIds = splits.rows.map((s) => s.target_account_id);
            const splitAccounts = splitAccountIds.length > 0
                ? await client.query(`
            SELECT account_id, owner_id, owner_type
            FROM bank_accounts
            WHERE account_id = ANY($1::text[]) AND tenant_id = $2
            `, [splitAccountIds, tenantId])
                : { rows: [] };
            const accountMap = new Map(splitAccounts.rows.map((a) => [a.account_id, { ownerId: a.owner_id, ownerType: a.owner_type }]));
            const splitTxs = splits.rows.map((split) => ({
                transaction_id: split.transaction_id,
                amountCents: split.amount,
                metadata: {
                    type: 'split',
                    splitType: split.split_type,
                    targetAccountId: split.target_account_id,
                    targetId: accountMap.get(split.target_account_id)?.ownerId,
                    targetType: accountMap.get(split.target_account_id)?.ownerType,
                    percentage: split.percentage ? parseFloat(split.percentage) : null,
                },
                createdAt: split.createdAt,
            }));
            const splitDetails = splitTxs.map((row) => {
                const metadata = row.metadata || {};
                // Mapear owner_type para targetType compatível
                let targetType = 'user';
                if (metadata.targetType === 'user')
                    targetType = 'user';
                else if (metadata.targetType === 'company' || metadata.targetType === 'group')
                    targetType = 'group';
                else if (metadata.splitType === 'regional_fund')
                    targetType = 'regional_fund';
                else if (metadata.splitType === 'fee')
                    targetType = 'platform';
                return {
                    transactionId: row.transaction_id,
                    targetType,
                    targetId: metadata.targetId,
                    percentage: metadata.percentage || 0,
                    amountCents: parseFloat(row.amount),
                    createdAt: row.createdAt,
                };
            });
            const totalPercentage = splitDetails.reduce((sum, s) => sum + s.percentage, 0);
            const totalAmount = splitDetails.reduce((sum, s) => sum + s.amount, 0);
            return {
                baseTransaction: {
                    transactionId: base.transaction_id,
                    amountCents: parseFloat(base.amount),
                    type: baseMetadata.type || 'other',
                    createdAt: base.createdAt,
                    metadata: baseMetadata,
                },
                splits: splitDetails,
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
        // 2. Resolver conta regional no Unify Bank (conta de sistema regional_fund)
        // Buscar conta regional_fund do sistema para a região do usuário
        const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
        const regionalFundAccount = await bankAccount.getSystemAccount(tenantId, 'regional_fund', 'BRL');
        if (!regionalFundAccount) {
            return null; // Não há fundo regional para esse usuário
        }
        const regionAccountId = regionalFundAccount.accountId;
        // 3. Obter saldo atual do Unify Bank
        const balance = await bankAccount.getBalance(tenantId, regionAccountId);
        // 4. Buscar movimentações do bank_ledger
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const ledgerEntries = await client.query(`
        SELECT l.transaction_id, l.entry_type, l.amount, l.createdAt
        FROM bank_ledger l
        WHERE l.account_id = $1 AND l.tenant_id = $2
        ORDER BY l.createdAt DESC
        LIMIT $3 OFFSET $4
        `, [regionAccountId, tenantId, limit, offset]);
            // 5. Buscar metadados das transações do Unify Bank
            const transactionIds = ledgerEntries.rows.map((r) => r.transaction_id);
            const transactions = transactionIds.length > 0
                ? await client.query(`
            SELECT transaction_id, metadata
            FROM bank_transactions
            WHERE transaction_id = ANY($1::text[]) AND tenant_id = $2
            `, [transactionIds, tenantId])
                : { rows: [] };
            const txMap = new Map();
            transactions.rows.forEach((tx) => {
                txMap.set(tx.transaction_id, (tx.metadata || {}));
            });
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
                    amountCents: parseFloat(row.amount),
                    origin,
                    originTransactionId: metadata.originTransactionId,
                    destination: metadata.targetId,
                    context: metadata.context,
                    createdAt: row.createdAt,
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
        // 1. Resolver conta regional no Unify Bank (conta de sistema regional_fund)
        const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
        const regionalFundAccount = await bankAccount.getSystemAccount(tenantId, 'regional_fund', 'BRL');
        if (!regionalFundAccount) {
            return null; // Não há conta regional para essa região
        }
        const regionAccountId = regionalFundAccount.accountId;
        // 2. Obter saldo atual do Unify Bank
        const balance = await bankAccount.getBalance(tenantId, regionAccountId);
        // 3. Buscar todas as movimentações do bank_ledger
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            let query = `
        SELECT 
          l.transaction_id,
          l.entry_type,
          l.amount,
          l.createdAt,
          t.metadata
        FROM bank_ledger l
        INNER JOIN bank_transactions t ON t.transaction_id = l.transaction_id
        WHERE l.account_id = $1 AND l.tenant_id = $2
      `;
            const params = [regionAccountId, tenantId];
            let paramIndex = 3;
            if (startDate) {
                query += ` AND l.createdAt >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            if (endDate) {
                query += ` AND l.createdAt <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            query += ` ORDER BY l.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
                    amountCents: parseFloat(row.amount),
                    origin,
                    originTransactionId: metadata.originTransactionId,
                    destination: metadata.targetId,
                    context: metadata.context,
                    createdAt: row.createdAt,
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
