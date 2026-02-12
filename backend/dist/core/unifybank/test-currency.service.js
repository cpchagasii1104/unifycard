"use strict";
// src/core/unifybank/test-currency.service.ts
//
// Serviço para gerenciar moeda fictícia de teste (TEST)
// Permite emissão de saldo para testes de fluxos econômicos
//
// REGRAS:
// - Apenas ambiente de desenvolvimento/teste
// - Apenas role 'admin' pode emitir
// - Todas as emissões são registradas no ledger
// - Rastreabilidade completa (adminId, userId, timestamp, reason)
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCurrencyService = void 0;
const account_service_1 = require("../economy/account.service");
const transaction_service_1 = require("../economy/transaction.service");
const pool_1 = require("@core/database/pool");
const uuid_1 = require("uuid");
const TEST_CURRENCY = 'TEST';
class TestCurrencyService {
    /**
     * Emite saldo fictício (TEST) para um usuário
     *
     * GARANTIAS:
     * - Apenas moeda TEST pode ser emitida
     * - Cria conta se não existir
     * - Registra transação no ledger
     * - Rastreabilidade completa
     */
    async emitTestCurrency(input) {
        const { tenantId, userId, amount, reason, adminId } = input;
        // Validação: apenas TEST
        if (amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }
        if (amount > 1000000) {
            throw new Error('Maximum emission amount is 1,000,000 TEST');
        }
        // 1. Buscar ou criar conta do usuário em TEST
        const userAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, userId, TEST_CURRENCY);
        // 2. Buscar ou criar conta "UnifyBank Treasury" (emissor) em TEST
        const treasuryAccount = await account_service_1.accountService.getOrCreateSystemAccount(tenantId, 'platform_ops', TEST_CURRENCY);
        // 3. Transferir de treasury para usuário (emissão)
        const transferResult = await transaction_service_1.transactionService.transfer(tenantId, {
            fromAccount: treasuryAccount.accountId,
            toAccount: userAccount.accountId,
            amount,
            eventId: (0, uuid_1.v4)(),
            metadata: {
                type: 'test_currency_emission',
                reason,
                adminId,
                userId,
                currency: TEST_CURRENCY,
                source: 'unifybank_test_currency',
            },
        });
        // 4. Buscar saldo atualizado
        const updatedAccount = await account_service_1.accountService.getAccountById(tenantId, userAccount.accountId);
        if (!updatedAccount) {
            throw new Error('Failed to retrieve updated account');
        }
        return {
            transactionId: transferResult.transaction.transactionId,
            accountId: userAccount.accountId,
            newBalance: updatedAccount.balance,
            amount,
            reason,
            emittedAt: new Date(),
        };
    }
    /**
     * Lista todas as emissões de TEST para um usuário
     * Busca no ledger todas as transações de emissão
     */
    async getTestCurrencyLedger(tenantId, userId, limit = 50, offset = 0) {
        // Buscar conta do usuário em TEST
        const userAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, userId, 'user');
        const testAccount = userAccounts.find(acc => acc.currency === TEST_CURRENCY);
        if (!testAccount) {
            return { entries: [], totalCents: 0 };
        }
        // Buscar entradas no ledger que são créditos (emissões)
        const entriesRows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        l.entry_id,
        l.transaction_id,
        l.account_id,
        l.amount,
        l.createdAt,
        t.metadata
      FROM ledger l
      INNER JOIN transactions t ON t.transaction_id = l.transaction_id
      WHERE 
        l.account_id = $1
        AND l.entry_type = 'credit'
        AND t.metadata->>'type' = 'test_currency_emission'
        AND t.currency = 'TEST'
      ORDER BY l.createdAt DESC
      LIMIT $2 OFFSET $3
      `, [testAccount.accountId, limit, offset]);
        const totalRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as count
      FROM ledger l
      INNER JOIN transactions t ON t.transaction_id = l.transaction_id
      WHERE 
        l.account_id = $1
        AND l.entry_type = 'credit'
        AND t.metadata->>'type' = 'test_currency_emission'
        AND t.currency = 'TEST'
      `, [testAccount.accountId]);
        const entries = (entriesRows || []).map((row) => ({
            entryId: row.entry_id,
            transactionId: row.transaction_id,
            accountId: row.account_id,
            amountCents: parseFloat(row.amount),
            reason: row.metadata?.reason || 'N/A',
            adminId: row.metadata?.adminId || 'N/A',
            userId: row.metadata?.userId || userId,
            createdAt: row.createdAt,
        }));
        return {
            entries,
            totalCents: parseInt(totalRow?.count || '0', 10),
        };
    }
    /**
     * Valida se a moeda é TEST (gate de segurança)
     */
    validateTestCurrency(currency) {
        return currency === TEST_CURRENCY;
    }
}
exports.testCurrencyService = new TestCurrencyService();
