// src/core/db.ts
//
// Fachada oficial de acesso ao banco.
// Usa o pool existente e garante compatibilidade com
// multi-tenant via app.current_tenant (PostgreSQL RLS).
//
// ⚠️ ATENÇÃO — GATE 3 (SSOT):
// Este módulo é APENAS infraestrutura.
// É PROIBIDO:
// - implementar lógica financeira aqui
// - atualizar saldo diretamente
// - decidir estado financeiro
// Qualquer uso financeiro deve passar pelo Bank (ledger).

import {
  pool,
  runQueriesWithTenant as rawRunQueriesWithTenant,
} from '@core/database/pool';
import type { PoolClient, QueryResultRow } from 'pg';

export interface QueryConfig {
  text: string;
  values?: any[];
}

/**
 * Executa queries que NÃO dependem de tenant.
 * Envia direto para o banco sem SET LOCAL.
 *
 * Exemplos permitidos:
 *  - leitura de tenants
 *  - autenticação
 *  - consultas de sistema
 *
 * ⚠️ Proibido:
 *  - decisões financeiras
 *  - atualização de saldo
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
 *  - Só use para tabelas multi-tenant
 *  - Nunca use para decidir estado financeiro
 *
 * 🔴 F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX (2026-07-02, achado A2 da re-auditoria
 * adversarial): esta função era uma FACHADA PARALELA com o mesmo bug fechado em
 * core/database/pool.ts::runQueryWithTenant — set_config(...,true) (is_local=true, escopo de
 * TRANSAÇÃO) sem BEGIN explícito evapora antes da query real rodar (statement seguinte roda em
 * transação implícita própria sob autocommit). Sob unificard_app (RLS-live), qualquer tabela com
 * FORCE ROW LEVEL SECURITY lida por aqui retornaria 0 linhas sempre. Fix: is_local=false +
 * reset explícito de app.is_platform_admin (mesma razão de F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-
 * FIX — a conexão pooled pode ter servido um caller anterior com GUC diferente setado).
 * Dormente hoje: nenhuma das tabelas lidas pelos 23 callers vivos (rides/checkout-ticket/
 * event-lifecycle) tem RLS ainda — mas landmine idêntica se essas tabelas ganharem RLS no futuro.
 */
export async function runQueryWithTenant<T extends QueryResultRow = any>(
  tenantId: string,
  query: QueryConfig
): Promise<T | undefined> {
  const client = await pool.connect();
  try {
    // PostgreSQL não aceita bind parameters em SET
    await client.query(
      "SELECT set_config('app.current_tenant', $1, false), set_config('app.is_platform_admin', 'false', false)",
      [tenantId]
    );

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
 * ⚠️ ATENÇÃO:
 * Esta função NÃO deve ser usada para:
 *  - atualizar saldo
 *  - executar lógica financeira
 *  - contornar o Bank / ledger
 *
 * Transações financeiras pertencem exclusivamente ao domínio bancário.
 */
export async function runTenantTransaction<T = any>(
  tenantId: string,
  fn: (trx: { query: (q: QueryConfig) => Promise<any> }) => Promise<T>
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.current_tenant', $1, true)",
      [tenantId]
    );

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
 * Transação tenant com `PoolClient` nativo — para `insertEventOutboxRow` e outros usos que exigem `pg` client.
 */
export async function runTenantTransactionWithClient<T = any>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transação de sistema — sem tenant.
 *
 * Permitido apenas para:
 *  - setup
 *  - manutenção
 *  - leitura / escrita não financeira
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
  runTenantTransactionWithClient,
  runSystemTransaction,
};

export default db;
