"use strict";
// backend/src/core/economy/transactions/transaction.service.ts
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
exports.transactionService = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
class TransactionService {
    /**
     * Converte row do banco para objeto Transaction
     */
    toTransaction(row) {
        return {
            transactionId: row.transaction_id,
            tenantId: row.tenant_id,
            fromAccount: row.from_account,
            toAccount: row.to_account,
            fromGlobalUserId: row.from_global_user_id ?? undefined,
            toGlobalUserId: row.to_global_user_id ?? undefined,
            amount: parseFloat(row.amount),
            eventId: row.event_id,
            status: row.status,
            metadata: row.metadata || {},
            createdAt: row.created_at,
        };
    }
    /**
     * Executa uma transferência atômica entre contas
     *
     * GARANTIAS:
     * - Transação SQL atômica (BEGIN...COMMIT)
     * - Validação de saldo
     * - Idempotência via event_id
     * - Double-entry bookkeeping no ledger
     * - Emissão de evento transaction.completed
     *
     * ROLLBACK automático em caso de:
     * - Saldo insuficiente
     * - Contas não encontradas
     * - Qualquer erro durante a transação
     */
    async transfer(tenantId, input) {
        const { fromAccount, toAccount, amount, eventId = (0, uuid_1.v4)(), metadata = {} } = input;
        // ==========================================
        // VALIDAÇÃO EXPLÍCITA DE CAMPOS OBRIGATÓRIOS
        // ==========================================
        if (amount === undefined) {
            const error = new Error('Amount is required');
            error.statusCode = 400;
            throw error;
        }
        if (fromAccount === undefined) {
            const error = new Error('fromAccount is required');
            error.statusCode = 400;
            throw error;
        }
        if (toAccount === undefined) {
            const error = new Error('toAccount is required');
            error.statusCode = 400;
            throw error;
        }
        // Criar variáveis seguras após validação
        const safeAmount = amount;
        const safeFromAccount = fromAccount;
        const safeToAccount = toAccount;
        // Validações básicas
        if (safeAmount <= 0) {
            const error = new Error('Amount must be greater than zero');
            error.statusCode = 400;
            throw error;
        }
        if (safeFromAccount === safeToAccount) {
            const error = new Error('Cannot transfer to the same account');
            error.statusCode = 400;
            throw error;
        }
        // Pega um client dedicado para essa transação
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            // ==========================================
            // INÍCIO DA TRANSAÇÃO ATÔMICA
            // ==========================================
            await client.query('BEGIN');
            // 1. Verifica se transação já existe (idempotência)
            const existingTx = await client.query('SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at FROM transactions WHERE event_id = $1 LIMIT 1', [eventId]);
            if (existingTx.rows.length > 0) {
                await client.query('COMMIT');
                const existingRow = existingTx.rows[0];
                // ==========================================
                // INVARIANTE 3: IDEMPOTÊNCIA ABSOLUTA
                // ==========================================
                // Validar que payload é idêntico (mesmo eventId = mesma operação)
                if (parseFloat(existingRow.amount) !== safeAmount ||
                    existingRow.from_account !== safeFromAccount ||
                    existingRow.to_account !== safeToAccount) {
                    const error = new Error(`Idempotency violation: same eventId (${eventId}) used with different payload`);
                    error.statusCode = 409;
                    throw error;
                }
                // NOTA: Não buscar owner_global_user_id de accounts (coluna pode não existir)
                // Os global_user_id já devem estar preenchidos na transação quando foi criada
                // Se não estiverem, deixar como null (não é crítico para funcionamento)
                const existing = this.toTransaction(existingRow);
                // Busca saldos atuais (sem lock, pois transação já foi commitada)
                const accountsResult = await client.query('SELECT account_id, balance FROM accounts WHERE account_id = ANY($1::text[])', [[safeFromAccount, safeToAccount]]);
                const accountsMap = new Map(accountsResult.rows.map(row => [row.account_id, parseFloat(row.balance)]));
                return {
                    transaction: existing,
                    fromAccountBalance: accountsMap.get(safeFromAccount) ?? 0,
                    toAccountBalance: accountsMap.get(safeToAccount) ?? 0,
                };
            }
            // 2. Busca e valida ambas as contas (FOR UPDATE para lock pessimista)
            // Lock em ordem alfabética para evitar deadlocks
            const [firstAccount, secondAccount] = [safeFromAccount, safeToAccount].sort();
            const accountsResult = await client.query(`SELECT account_id, balance, owner_type
         FROM accounts 
         WHERE account_id = ANY($1::text[])
         ORDER BY account_id
         FOR UPDATE`, [[firstAccount, secondAccount]]);
            if (accountsResult.rows.length !== 2) {
                const foundIds = new Set(accountsResult.rows.map(r => r.account_id));
                const missing = [safeFromAccount, safeToAccount].filter(id => !foundIds.has(id));
                throw new Error(`Account(s) not found: ${missing.join(', ')}`);
            }
            // Mapeia as contas encontradas
            const accountsMap = new Map(accountsResult.rows.map(row => [row.account_id, parseFloat(row.balance)]));
            const accountsInfoMap = new Map(accountsResult.rows.map(row => [
                row.account_id,
                {
                    balance: parseFloat(row.balance),
                    ownerType: row.owner_type,
                },
            ]));
            const fromBalance = accountsMap.get(safeFromAccount);
            const toBalance = accountsMap.get(safeToAccount);
            // Resolver global_user_id das contas (se owner_type = 'user')
            // NOTA: Não usar owner_global_user_id (coluna pode não existir)
            // Deixar como null se não conseguir resolver de outra forma
            const fromInfo = accountsInfoMap.get(safeFromAccount);
            const toInfo = accountsInfoMap.get(safeToAccount);
            const fromGlobalUserId = null; // Não buscar de owner_global_user_id
            const toGlobalUserId = null; // Não buscar de owner_global_user_id
            // 3. Valida saldo suficiente
            if (fromBalance < safeAmount) {
                const error = new Error('Insufficient balance');
                error.statusCode = 400;
                throw error;
            }
            // 4. Calcula novos saldos
            const newFromBalance = fromBalance - safeAmount;
            const newToBalance = toBalance + safeAmount;
            // ==========================================
            // INVARIANTE 2: SALDO NÃO-NEGATIVO (USER_PRIMARY)
            // ==========================================
            // Verificar se conta de usuário não ficará negativa (após lock, antes de criar ledger)
            const fromAccountInfo = accountsInfoMap.get(safeFromAccount);
            if (fromAccountInfo?.ownerType === 'user' && newFromBalance < 0) {
                const error = new Error(`Non-negative balance invariant violated: user account ${safeFromAccount} would have negative balance (${newFromBalance})`);
                error.statusCode = 400;
                throw error;
            }
            // 5. Atualiza ambas as contas em uma única query (mais eficiente)
            await client.query(`UPDATE accounts 
         SET balance = CASE account_id
           WHEN $1 THEN $2
           WHEN $3 THEN $4
         END
         WHERE account_id IN ($1, $3)`, [safeFromAccount, newFromBalance, safeToAccount, newToBalance]);
            // 6. Cria registro da transação
            const txResult = await client.query(`INSERT INTO transactions (tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at`, [tenantId, safeFromAccount, safeToAccount, fromGlobalUserId, toGlobalUserId, safeAmount, eventId, 'completed', metadata]);
            const transaction = this.toTransaction(txResult.rows[0]);
            // 7. Cria entradas no ledger (double-entry bookkeeping) em batch
            await client.query(`INSERT INTO ledger (tenant_id, account_id, transaction_id, entry_type, amount, balance_before, balance_after)
         VALUES 
           ($1, $2, $3, $4, $5, $6, $7),
           ($1, $8, $3, $9, $5, $10, $11)`, [
                tenantId,
                safeFromAccount,
                transaction.transactionId,
                'debit',
                safeAmount,
                fromBalance,
                newFromBalance,
                safeToAccount,
                'credit',
                toBalance,
                newToBalance
            ]);
            // ==========================================
            // INVARIANTE 1: DOUBLE-ENTRY BALANCEADO
            // ==========================================
            // Validar que sum(debits) === sum(credits) para esta transação
            const balanceCheck = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0)::text as total_debits,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0)::text as total_credits
        FROM ledger
        WHERE transaction_id = $1
        `, [transaction.transactionId]);
            const totalDebits = parseFloat(balanceCheck.rows[0]?.total_debits || '0');
            const totalCredits = parseFloat(balanceCheck.rows[0]?.total_credits || '0');
            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                // Rollback e erro explícito
                await client.query('ROLLBACK');
                const error = new Error(`Double-entry invariant violated: debits (${totalDebits}) != credits (${totalCredits})`);
                error.statusCode = 500;
                throw error;
            }
            // ==========================================
            // INVARIANTE 2: SALDO NÃO-NEGATIVO (USER_PRIMARY)
            // ==========================================
            // Verificar se contas de usuário não ficaram negativas
            const negativeBalanceCheck = await client.query(`
        SELECT a.account_id, a.balance, a.owner_type
        FROM accounts a
        WHERE a.account_id IN ($1, $2)
          AND a.owner_type = 'user'
          AND a.balance < 0
        `, [safeFromAccount, safeToAccount]);
            if (negativeBalanceCheck.rows.length > 0) {
                // Rollback e erro explícito
                await client.query('ROLLBACK');
                const error = new Error(`Non-negative balance invariant violated: account ${negativeBalanceCheck.rows[0].account_id} has negative balance`);
                error.statusCode = 400;
                throw error;
            }
            // ==========================================
            // COMMIT DA TRANSAÇÃO ATÔMICA
            // ==========================================
            await client.query('COMMIT');
            // 8. Emite evento de transação concluída (fora da transação SQL)
            // Usa setImmediate para não bloquear o retorno da resposta
            setImmediate(async () => {
                try {
                    await event_bus_1.eventBus.publish({
                        tenantId,
                        type: 'transaction.completed',
                        payload: {
                            transactionId: transaction.transactionId,
                            fromAccount: safeFromAccount,
                            toAccount: safeToAccount,
                            amount: safeAmount,
                            eventId,
                            metadata,
                        },
                    });
                }
                catch (error) {
                    // Log do erro mas não falha a transação (já foi commitada)
                    console.error('Failed to publish transaction.completed event:', error);
                }
            });
            return {
                transaction,
                fromAccountBalance: newFromBalance,
                toAccountBalance: newToBalance,
            };
        }
        catch (error) {
            // Rollback em caso de erro
            await client.query('ROLLBACK');
            // Re-lança o erro com status code apropriado
            if (error.statusCode) {
                throw error;
            }
            const err = new Error(error.message || 'Transaction failed');
            err.statusCode = 500;
            throw err;
        }
        finally {
            // Sempre libera o client
            client.release();
        }
    }
    /**
     * Busca transação por ID
     */
    async getTransactionById(tenantId, transactionId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const result = await client.query(`SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
         FROM transactions
         WHERE transaction_id = $1
         LIMIT 1`, [transactionId]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.toTransaction(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    /**
     * Busca transação por event_id (para idempotência)
     */
    async getTransactionByEventId(tenantId, eventId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const result = await client.query(`SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
         FROM transactions
         WHERE event_id = $1
         LIMIT 1`, [eventId]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.toTransaction(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    /**
     * Lista transações de uma conta
     */
    async getTransactionsByAccount(tenantId, accountId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const result = await client.query(`SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
         FROM transactions
         WHERE from_account = $1 OR to_account = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`, [accountId, limit, offset]);
            return result.rows.map((row) => this.toTransaction(row));
        }
        finally {
            client.release();
        }
    }
    /**
     * Busca transações de um global_user_id (agregado de todos os tenants)
     */
    async getTransactionsByGlobalUserId(globalUserId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const result = await pool.query(`
      SELECT transaction_id, tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata, created_at
      FROM transactions
      WHERE from_global_user_id = $1 OR to_global_user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `, [globalUserId, limit, offset]);
        return result.rows.map((row) => this.toTransaction(row));
    }
}
exports.transactionService = new TransactionService();
