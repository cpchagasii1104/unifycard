"use strict";
// src/core/db.ts
//
// Fachada oficial de acesso ao banco.
// Usa o pool existente e garante compatibilidade com
// multi-tenant via app.current_tenant (PostgreSQL RLS).
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSystemQuery = runSystemQuery;
exports.runQueryWithTenant = runQueryWithTenant;
exports.runQueriesWithTenant = runQueriesWithTenant;
exports.runTenantTransaction = runTenantTransaction;
exports.runSystemTransaction = runSystemTransaction;
const pool_1 = require("@core/database/pool");
/**
 * Executa queries que NÃO dependem de tenant.
 * Envia direto para o banco sem SET LOCAL.
 *
 * Exemplos:
 *  - leitura de tenants
 *  - autenticação
 *  - consultas de sistema
 */
async function runSystemQuery(query) {
    const client = await pool_1.pool.connect();
    try {
        const result = await client.query(query.text.trim(), query.values ?? []);
        return result.rows;
    }
    finally {
        client.release();
    }
}
/**
 * Executa queries protegidas por RLS, definindo o tenant no contexto.
 *
 * IMPORTANTE:
 *  - Só use isso para tabelas multi-tenant
 *  - Nunca chame em tabelas de sistema
 */
async function runQueryWithTenant(tenantId, query) {
    const client = await pool_1.pool.connect();
    try {
        // PostgreSQL não aceita bind parameters em SET LOCAL, usar set_config com true (local)
        await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
        const result = await client.query(query.text.trim(), query.values ?? []);
        return result.rows[0];
    }
    finally {
        client.release();
    }
}
async function runQueriesWithTenant(tenantId, query) {
    return (0, pool_1.runQueriesWithTenant)(tenantId, query.text, query.values);
}
/**
 * Inicia uma transação isolada COM suporte a multi-tenant.
 *
 * Exemplo de uso:
 *
 * const result = await runTenantTransaction(tenantId, async (trx) => {
 *    await trx.query({ text: "UPDATE accounts SET balance = balance - 10 WHERE id=$1", values: [accA] });
 *    await trx.query({ text: "UPDATE accounts SET balance = balance + 10 WHERE id=$1", values: [accB] });
 *    return true;
 * });
 */
async function runTenantTransaction(tenantId, fn) {
    const client = await pool_1.pool.connect();
    try {
        await client.query('BEGIN');
        // PostgreSQL não aceita bind parameters em SET LOCAL, usar set_config com true (local)
        await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
        const trx = {
            query: async (q) => {
                const result = await client.query(q.text.trim(), q.values ?? []);
                return result.rows;
            },
        };
        const output = await fn(trx);
        await client.query('COMMIT');
        return output;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
/**
 * Transação de sistema — sem tenant.
 */
async function runSystemTransaction(fn) {
    const client = await pool_1.pool.connect();
    try {
        await client.query('BEGIN');
        const trx = {
            query: async (q) => {
                const result = await client.query(q.text.trim(), q.values ?? []);
                return result.rows;
            },
        };
        const output = await fn(trx);
        await client.query('COMMIT');
        return output;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// Compatibilidade com chamadas que importam `db` como default.
const db = {
    runSystemQuery,
    runQueryWithTenant,
    runQueriesWithTenant,
    runTenantTransaction,
    runSystemTransaction,
};
exports.default = db;
