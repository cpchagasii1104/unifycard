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
  runQueryWithTenant as rawRunQueryWithTenant,
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
 * DT-HELPERS-DUAL-IMPLEMENTATION-DRIFT (fechada 2026-07-05): esta função era uma
 * IMPLEMENTAÇÃO PRÓPRIA duplicada de `core/database/pool.ts::runQueryWithTenant` — mesmo
 * `set_config` copiado à mão (já corrigido em paralelo por `F-GUC-TENANT-CONTEXT-TRANSACTION-
 * SCOPE-FIX`, 2026-07-02, nas DUAS cópias), mas SEM a sanitização `undefined→null` nem o log
 * estruturado de erro (redigido em produção) que `pool.ts` tem. Os 44 callers de `@core/db`
 * (majoritariamente `modules/rides/*`, mais `checkout`, `groups/votes`, `events/*`, `feed/*`)
 * ficavam sem essas duas proteções. Agora delega DIRETO pra `pool.ts` — mesmo padrão que
 * `runQueriesWithTenant` (abaixo) já usava — zero mudança de import necessária nos 44 arquivos,
 * mesma assinatura pública, comportamento estritamente melhor (ganham sanitização + log).
 */
export async function runQueryWithTenant<T extends QueryResultRow = any>(
  tenantId: string,
  query: QueryConfig
): Promise<T | undefined> {
  return rawRunQueryWithTenant<T>(tenantId, query.text, query.values);
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
