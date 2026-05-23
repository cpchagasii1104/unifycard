import { pool } from '@core/database/pool';

export type TenantSemanticPolicyRow = {
  tenant_id: string;
  allow_slug_fallback: boolean;
  log_fallback_as_error: boolean;
  enforce_graph: boolean;
};

/**
 * Linha explícita de política semântica do tenant, ou null se não configurado.
 */
export async function getTenantSemanticPolicy(
  tenantId: string
): Promise<TenantSemanticPolicyRow | null> {
  const { rows } = await pool.query<TenantSemanticPolicyRow>(
    `
    SELECT tenant_id, allow_slug_fallback, log_fallback_as_error, enforce_graph
    FROM tenant_semantic_policy
    WHERE tenant_id = $1
    `,
    [tenantId]
  );
  return rows[0] ?? null;
}