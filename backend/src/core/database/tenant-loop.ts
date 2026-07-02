// backend/src/core/database/tenant-loop.ts
// F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS — materializa o padrão canônico da DECISION-0149
// (RLS Cross-Tenant Connection Model, Opção B-heavy): jobs/monitores cross-tenant NÃO usam conexão
// global/bypass; descobrem tenants por fonte NÃO-RLS (tabela `tenants`, sem RLS — verificado) e
// iteram tenant-by-tenant com tenant-context (`getClientWithTenant`/`runQueriesWithTenant`).
//
// 🔴 Este helper é SÓ discovery (lista de ids). Ele NÃO abre contexto de tenant — cada worker abre
// o próprio client com contexto por tenant dentro do loop. Não usar em rota de request (rotas já
// têm o tenant do subject; discovery cross-tenant em rota seria vazamento de desenho).

import { pool } from './pool';

/**
 * Lista os ids de todos os tenants para iteração de worker (DECISION-0149 tenant-loop).
 * Fonte não-RLS: `tenants`. Ordem estável (created_at) para justiça de processamento.
 */
export async function listTenantIdsForWorkerLoop(): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM tenants ORDER BY created_at ASC`
  );
  return result.rows.map((r) => r.id);
}
