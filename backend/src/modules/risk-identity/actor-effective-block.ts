import { runQueryWithTenant } from '@core/database/pool';

/**
 * Verifica se um actor está efetivamente bloqueado:
 * - diretamente via atl_blocked_actors no mesmo tenant, OU
 * - o seu responsible_actor_id (âncora humana) está bloqueado no mesmo tenant
 */
export async function isActorEffectivelyBlocked(
  tenantId: string,
  actorId: string
): Promise<boolean> {
  const row = await runQueryWithTenant<{ blocked: boolean }>(
    tenantId,
    `
    SELECT EXISTS (
      SELECT 1
      FROM atl_blocked_actors atl
      WHERE atl.tenant_id = $1
        AND atl.actor_id = $2
      UNION ALL
      SELECT 1
      FROM atl_blocked_actors atl
      INNER JOIN actors a
        ON a.id = $2
       AND a.tenant_id = $1
      WHERE atl.tenant_id = $1
        AND a.responsible_actor_id IS NOT NULL
        AND atl.actor_id = a.responsible_actor_id
    ) AS blocked
    `,
    [tenantId, actorId]
  );
  return row?.blocked ?? false;
}