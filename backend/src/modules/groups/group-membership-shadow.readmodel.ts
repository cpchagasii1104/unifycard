// backend/src/modules/groups/group-membership-shadow.readmodel.ts
// D9.2-A (DECISION-0188 D16 fase de MEDIÇÃO) — shadow validation READ-ONLY do legado.
// Mede, SEM ESCREVER, a convergência determinística:
//   group_members.user_id → users → global_user_id → user-actor canônico → candidate member_actor_id
// NÃO: escreve · cria Actor · cria membership · corrige dado · usa fallback · usa email/nome ·
// usa "primeiro resultado" · lê a casa nova como fallback do legado. Serve SÓ a medição e prova.
// Comparações NUNCA cruzam namespaces: cada passo resolve pela cadeia canônica (0131 B3).

import { runQueriesWithTenant } from '@core/database/pool';
import type {
  LegacyMembershipReadiness,
  LegacyMembershipShadowReport,
  LegacyMembershipShadowRow,
} from './group-actor-membership.types';

interface ShadowRow {
  legacy_id: string;
  tenant_id: string;
  group_id: string;
  legacy_user_id: string;
  group_tenant_id: string | null;
  group_status: string | null;
  users_found: string;      // count::text
  global_user_id: string | null;
  user_actor_count: string; // count::text
  candidate_actor_id: string | null;
}

function classify(r: ShadowRow): LegacyMembershipReadiness {
  if (!r.group_tenant_id || r.group_status === null) return 'invalid_group';
  if (r.group_tenant_id !== r.tenant_id) return 'tenant_mismatch';
  if (Number(r.users_found) === 0) return 'missing_user';
  if (!r.global_user_id) return 'missing_identity';
  const actorCount = Number(r.user_actor_count);
  if (actorCount === 0) return 'missing_user_actor';
  if (actorCount > 1) return 'ambiguous_user_actor';
  return 'ready';
}

/**
 * Medição pura por tenant. Uma única passada SQL read-only; classificação determinística por row.
 */
export async function measureLegacyMembershipConvergence(tenantId: string): Promise<LegacyMembershipShadowReport> {
  if (!tenantId?.trim()) {
    throw new Error('GAM_SHADOW_INPUT_NULL: tenantId obrigatorio para medicao.');
  }
  const rows = await runQueriesWithTenant<ShadowRow>(
    tenantId,
    `
    SELECT gm.id::text                AS legacy_id,
           gm.tenant_id::text         AS tenant_id,
           gm.group_id::text          AS group_id,
           gm.user_id::text           AS legacy_user_id,
           g.tenant_id::text          AS group_tenant_id,
           g.status                   AS group_status,
           (SELECT count(*) FROM users u
             WHERE u.user_id = gm.user_id AND u.tenant_id = gm.tenant_id)::text AS users_found,
           (SELECT u.global_user_id::text FROM users u
             WHERE u.user_id = gm.user_id AND u.tenant_id = gm.tenant_id LIMIT 1) AS global_user_id,
           (SELECT count(*) FROM actors a
             WHERE a.tenant_id = gm.tenant_id AND a.user_id = gm.user_id
               AND a.actor_type = 'user')::text AS user_actor_count,
           (SELECT a.id::text FROM actors a
             WHERE a.tenant_id = gm.tenant_id AND a.user_id = gm.user_id
               AND a.actor_type = 'user'
             ORDER BY a.created_at ASC LIMIT 1) AS candidate_actor_id
      FROM group_members gm
      LEFT JOIN groups g ON g.id = gm.group_id
     WHERE gm.tenant_id = $1
     ORDER BY gm.created_at ASC, gm.id ASC
    `,
    [tenantId]
  );

  const out: LegacyMembershipShadowRow[] = rows.map((r) => {
    const readiness = classify(r);
    return {
      legacyMembershipId: r.legacy_id,
      tenantId: r.tenant_id,
      groupId: r.group_id,
      legacyUserId: r.legacy_user_id,
      globalUserId: r.global_user_id,
      // candidate SÓ é exposto quando a resolução é DETERMINÍSTICA (exatamente 1 user-actor)
      candidateMemberActorId: readiness === 'ready' ? r.candidate_actor_id : null,
      readiness,
    };
  });

  return {
    totalLegacyRows: out.length,
    readyRows: out.filter((r) => r.readiness === 'ready').length,
    rows: out,
    deterministic: out.every((r) => r.readiness === 'ready'),
  };
}
