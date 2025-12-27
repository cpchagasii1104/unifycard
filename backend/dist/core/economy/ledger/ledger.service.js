"use strict";
// backend/src/core/economy/ledger/ledger.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerService = void 0;
const pool_1 = require("@core/database/pool");
class LedgerService {
    /**
     * Converte row do banco para objeto LedgerEntry
     */
    toLedgerEntry(row) {
        return {
            entryId: row.entry_id,
            tenantId: row.tenant_id,
            accountId: row.account_id,
            transactionId: row.transaction_id,
            entryType: row.entry_type,
            amount: parseFloat(row.amount),
            balanceBefore: parseFloat(row.balance_before),
            balanceAfter: parseFloat(row.balance_after),
            createdAt: row.created_at,
        };
    }
    /**
     * Busca entradas do ledger de uma conta
     *
     * O ledger é IMUTÁVEL - uma vez criado, nunca é alterado.
     * Isso garante auditabilidade completa de todas transações.
     */
    async getLedgerEntries(tenantId, accountId, options = {}) {
        const { limit = 100, offset = 0, startDate, endDate, entryType } = options;
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            let query = `
        SELECT entry_id, tenant_id, account_id, transaction_id, entry_type, 
               amount, balance_before, balance_after, created_at
        FROM ledger
        WHERE account_id = $1
      `;
            const params = [accountId];
            let paramIndex = 2;
            // Filtro por data de início
            if (startDate) {
                query += ` AND created_at >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }
            // Filtro por data de fim
            if (endDate) {
                query += ` AND created_at <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }
            // Filtro por tipo de entrada
            if (entryType) {
                query += ` AND entry_type = $${paramIndex}`;
                params.push(entryType);
                paramIndex++;
            }
            query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
            const result = await client.query(query, params);
            return result.rows.map((row) => this.toLedgerEntry(row));
        }
        finally {
            client.release();
        }
    }
    /**
     * Busca uma entrada específica do ledger
     */
    async getLedgerEntry(tenantId, entryId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const result = await client.query(`SELECT entry_id, tenant_id, account_id, transaction_id, entry_type, 
                amount, balance_before, balance_after, created_at
         FROM ledger
         WHERE entry_id = $1
         LIMIT 1`, [entryId]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.toLedgerEntry(result.rows[0]);
        }
        finally {
            client.release();
        }
    }
    /**
     * Busca todas as entradas de uma transação
     * Uma transação sempre tem 2 entradas: débito e crédito
     */
    async getLedgerEntriesByTransaction(tenantId, transactionId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            const result = await client.query(`SELECT entry_id, tenant_id, account_id, transaction_id, entry_type, 
                amount, balance_before, balance_after, created_at
         FROM ledger
         WHERE transaction_id = $1
         ORDER BY entry_type DESC`, // Crédito primeiro, depois débito
            [transactionId]);
            return result.rows.map((row) => this.toLedgerEntry(row));
        }
        finally {
            client.release();
        }
    }
    /**
     * Gera sumário de movimentação de uma conta
     *
     * Calcula:
     * - Total de créditos
     * - Total de débitos
     * - Saldo líquido
     * - Número de transações
     */
    async getAccountSummary(tenantId, accountId, options = {}) {
        const { startDate, endDate } = options;
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            let query = `
        SELECT 
          SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END) as total_credits,
          SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END) as total_debits,
          COUNT(DISTINCT transaction_id) as transaction_count
        FROM ledger
        WHERE account_id = $1
      `;
            const params = [accountId];
            let paramIndex = 2;
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
            const result = await client.query(query, params);
            const row = result.rows[0];
            const totalCredits = parseFloat(row.total_credits || '0');
            const totalDebits = parseFloat(row.total_debits || '0');
            return {
                accountId,
                totalCredits,
                totalDebits,
                netBalance: totalCredits - totalDebits,
                transactionCount: parseInt(row.transaction_count || '0', 10),
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Verifica integridade do ledger de uma conta
     *
     * Valida que:
     * - Cada entrada tem balance_after = balance_before +/- amount
     * - O saldo atual da conta corresponde ao último balance_after
     *
     * Retorna true se tudo estiver correto, false se houver inconsistência
     */
    async verifyLedgerIntegrity(tenantId, accountId) {
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        try {
            // Busca todas as entradas em ordem cronológica
            const entriesResult = await client.query(`SELECT entry_id, entry_type, amount, balance_before, balance_after
         FROM ledger
         WHERE account_id = $1
         ORDER BY created_at ASC`, [accountId]);
            const entries = entriesResult.rows;
            if (entries.length === 0) {
                return true; // Ledger vazio é válido
            }
            // Valida cada entrada
            for (const entry of entries) {
                const balanceBefore = parseFloat(entry.balance_before);
                const balanceAfter = parseFloat(entry.balance_after);
                const amount = parseFloat(entry.amount);
                const expectedBalanceAfter = entry.entry_type === 'credit' ? balanceBefore + amount : balanceBefore - amount;
                // Verifica se o balance_after está correto
                if (Math.abs(balanceAfter - expectedBalanceAfter) > 0.01) {
                    // Tolerância de 1 centavo para erros de arredondamento
                    return false;
                }
            }
            // Verifica se o saldo atual da conta corresponde ao último balance_after
            const accountResult = await client.query('SELECT balance FROM accounts WHERE account_id = $1 LIMIT 1', [accountId]);
            if (accountResult.rows.length === 0) {
                return false; // Conta não existe
            }
            const currentBalance = parseFloat(accountResult.rows[0].balance);
            const lastBalanceAfter = parseFloat(entries[entries.length - 1].balance_after);
            return Math.abs(currentBalance - lastBalanceAfter) < 0.01;
        }
        finally {
            client.release();
        }
    }
}
exports.ledgerService = new LedgerService();
//# sourceMappingURL=ledger.service.js.map