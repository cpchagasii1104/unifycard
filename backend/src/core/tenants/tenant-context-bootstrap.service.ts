// Bootstrap institucional: delegação mínima de autoridade para leitura de categorias por contexto.

// Contrato: @unificard/contracts CategoryContext — sem isso, hasReadAccess → CONTEXT_ACCESS_DENIED.

// Idempotente: ON CONFLICT DO NOTHING.

// SSOT: apenas tenant.service.createTenant invoca bootstrap (não exportar fluxos paralelos de autoridade).



import type { PoolClient } from 'pg';

import { pool } from '@core/database/pool';

import type { CategoryContext } from '@unificard/contracts';



/** Contextos canónicos; permissão inicial default = read (leitura da árvore N0–N3). */

export const DEFAULT_TENANT_CATEGORY_CONTEXTS: readonly CategoryContext[] = [

  'professional',

  'interest',

  'education',

  'hobby',

  'learning',

  'health',

  'company',

  'lifestyle',

] as const;



type Queryable = Pick<PoolClient, 'query'>;



/**

 * Insere linhas canónicas em tenant_contexts. Só deve ser chamado dentro de createTenant (mesma transação).

 */

export async function bootstrapTenantContexts(tenantId: string, client?: Queryable): Promise<void> {

  const q = client ? client.query.bind(client) : pool.query.bind(pool);

  for (const context of DEFAULT_TENANT_CATEGORY_CONTEXTS) {

    await q(

      `INSERT INTO tenant_contexts (tenant_id, context, permission)

       VALUES ($1, $2, 'read')

       ON CONFLICT (tenant_id, context) DO NOTHING`,

      [tenantId, context]

    );

  }

}



export const tenantContextBootstrapService = {

  bootstrapTenantContexts,

};