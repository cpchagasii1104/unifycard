// src/core/db.ts
//
// Fachada oficial de acesso ao banco.
// Usa o pool existente e garante compatibilidade com
// multi-tenant via app.current_tenant (PostgreSQL RLS).

import {
  pool,
  runQueriesWithTenant as rawRunQueriesWithTenant,
} from '@core/database/pool';
import type { QueryResultRow } from 'pg';

export interface QueryConfig {
  text: string;
  values?: any[];
}

/**
 * Executa queries que NÃO dependem de tenant.
 * Envia direto para o banco sem SET LOCAL.
 *
 * Exemplos:
 *  - leitura de tenants
 *  - autenticação
 *  - consultas de sistema
 */
export async function runSystemQuery<T extends QueryResultRow = any>(
  query: QueryConfig
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(query.text.trim(), query.values ?? []);
    return result.rows;
  } finally {
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
export async function runQueryWithTenant<T extends QueryResultRow = any>(
  tenantId: string,
  query: QueryConfig
): Promise<T | undefined> {
  const client = await pool.connect();
  try {
    // PostgreSQL não aceita bind parameters em SET LOCAL, usar set_config com true (local)
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);

    const result = await client.query<T>(query.text.trim(), query.values ?? []);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function runQueriesWithTenant<T extends QueryResultRow = any>(
  tenantId: string,
  query: QueryConfig
): Promise<T[]> {
  return rawRunQueriesWithTenant<T>(tenantId, query.text, query.values);
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
export async function runTenantTransaction<T = any>(
  tenantId: string,
  fn: (trx: { query: (q: QueryConfig) => Promise<any> }) => Promise<T>
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // PostgreSQL não aceita bind parameters em SET LOCAL, usar set_config com true (local)
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);

    const trx = {
      query: async (q: QueryConfig) => {
        const result = await client.query(q.text.trim(), q.values ?? []);
        return result.rows;
      },
    };

    const output = await fn(trx);

    await client.query('COMMIT');
    return output;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transação de sistema — sem tenant.
 */
export async function runSystemTransaction<T = any>(
  fn: (trx: { query: (q: QueryConfig) => Promise<any> }) => Promise<T>
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const trx = {
      query: async (q: QueryConfig) => {
        const result = await client.query(q.text.trim(), q.values ?? []);
        return result.rows;
      },
    };

    const output = await fn(trx);

    await client.query('COMMIT');
    return output;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
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

export default db;