// backend/src/modules/authority/actor-capability-grant.repository.ts
// F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136) + N2-D.2 (DECISION-0173): grava/revoga por meio
// das FUNÇÕES CANÔNICAS transacionais (fn_grant_actor_capability/fn_revoke_actor_capability_grant) —
// unificard_app NÃO tem mais INSERT/UPDATE/DELETE diretos em actor_capability_grants (fronteira de
// escrita fechada na migration 20260711170000). Estado + evento append-only nascem atômicos na função.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ActorCapabilityGrant } from './actor-capability-grant.types';

interface GrantRow {
  grant_id: string;
  tenant_id: string | null;
  grantee_actor_id: string;
  capability_key: string;
  scope_type: string;
  scope_actor_id: string | null;
  scope_city_id: string | null;
  granted_by_user_id: string;
  granted_by_actor_id: string;
  authority_source: string;
  status: string;
  valid_from: string;
  valid_until: string | null;
  revoked_at: string | null;
  revoked_by_actor_id: string | null;
  reason: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS = `
  grant_id::text, tenant_id::text, grantee_actor_id::text, capability_key, scope_type,
  scope_actor_id::text, scope_city_id::text, granted_by_user_id::text, granted_by_actor_id::text,
  authority_source, status, valid_from, valid_until, revoked_at, revoked_by_actor_id::text,
  reason, revoke_reason, created_at, updated_at
`;

function toGrant(r: GrantRow): ActorCapabilityGrant {
  return {
    grantId: r.grant_id,
    tenantId: r.tenant_id,
    granteeActorId: r.grantee_actor_id,
    capabilityKey: r.capability_key,
    scopeType: r.scope_type as 'actor' | 'territory',
    scopeActorId: r.scope_actor_id,
    scopeCityId: r.scope_city_id,
    grantedByUserId: r.granted_by_user_id,
    grantedByActorId: r.granted_by_actor_id,
    authoritySource: r.authority_source,
    status: r.status as ActorCapabilityGrant['status'],
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    revokedAt: r.revoked_at,
    revokedByActorId: r.revoked_by_actor_id,
    reason: r.reason,
    revokeReason: r.revoke_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const actorCapabilityGrantRepository = {
  /**
   * Cria grant ACTOR-SCOPED via fn_grant_actor_capability (state+evento granted atômico na função).
   * scope_type='actor' é fixo dentro da função — este repository nunca envia scope_type/scope_city_id.
   */
  async insert(
    tenantId: string,
    data: {
      granteeActorId: string;
      capabilityKey: string;
      scopeActorId: string;
      grantedByUserId: string;
      grantedByActorId: string;
      authoritySource: string;
      validUntil: Date | null;
      reason: string | null;
      executedByUserId: string;
      executedByActorId: string;
      responsibleHumanActorId: string;
      eventReason: string;
    }
  ): Promise<ActorCapabilityGrant> {
    const row = await runQueryWithTenant<GrantRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM fn_grant_actor_capability(
         $1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6::uuid,$7,$8,$9,$10::uuid,$11::uuid,$12::uuid,$13
       ) AS g`,
      [
        tenantId,
        data.granteeActorId,
        data.capabilityKey,
        data.scopeActorId,
        data.grantedByUserId,
        data.grantedByActorId,
        data.authoritySource,
        data.validUntil,
        data.reason,
        data.executedByUserId,
        data.executedByActorId,
        data.responsibleHumanActorId,
        data.eventReason,
      ]
    );
    if (!row) throw new Error('Falha ao gravar capability grant');
    return toGrant(row);
  },

  /** Grant ATIVO específico (tenant + grantee + capability + scope). null se não houver. Actor-scoped. */
  async findActive(
    tenantId: string,
    granteeActorId: string,
    capabilityKey: string,
    scopeActorId: string
  ): Promise<ActorCapabilityGrant | null> {
    const row = await runQueryWithTenant<GrantRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM actor_capability_grants
        WHERE tenant_id=$1::uuid AND grantee_actor_id=$2::uuid AND capability_key=$3
          AND scope_type='actor' AND scope_actor_id=$4::uuid AND status='active'
          AND (valid_until IS NULL OR valid_until > now())
        LIMIT 1`,
      [tenantId, granteeActorId, capabilityKey, scopeActorId]
    );
    return row ? toGrant(row) : null;
  },

  /**
   * N2-D.3: assertion + LOCK do grant territorial via a função canônica SQL fn_assert_territorial_capability
   * (SECURITY DEFINER; valida key territorial exata, grantee Actor tenant-bound, grant global ATIVO por
   * city, cardinalidade 0/1/>1 fail-closed; FOR SHARE até o fim da transação). NÃO reimplementa a query/
   * lifecycle no TS — a função é a autoridade e a barreira atômica da row. Retorna grant_id aprovado, ou
   * `null` quando a função NEGA (TERRITORIAL_CAPABILITY_DENIED, uniforme não-vazante). Erro inesperado de
   * infra PROPAGA (nunca convertido em null). O `tenantId` só posiciona a conexão do app (a função não
   * filtra tenant; o grant é global e a representabilidade compõe no service).
   */
  async assertTerritorialCapability(
    tenantId: string,
    granteeActorId: string,
    capabilityKey: string,
    scopeCityId: string
  ): Promise<string | null> {
    try {
      const row = await runQueryWithTenant<{ grant_id: string }>(
        tenantId,
        `SELECT public.fn_assert_territorial_capability($1::uuid,$2,$3::uuid) AS grant_id`,
        [granteeActorId, capabilityKey, scopeCityId]
      );
      return row ? row.grant_id : null;
    } catch (error: any) {
      const msg = error?.message || '';
      if (/TERRITORIAL_CAPABILITY_DENIED/.test(msg)) return null;
      throw error; // infra/DB inesperado: propaga, nunca vira null (fail-closed honesto)
    }
  },

  async getById(tenantId: string, grantId: string): Promise<ActorCapabilityGrant | null> {
    const row = await runQueryWithTenant<GrantRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM actor_capability_grants WHERE tenant_id=$1::uuid AND grant_id=$2::uuid LIMIT 1`,
      [tenantId, grantId]
    );
    return row ? toGrant(row) : null;
  },

  async list(
    tenantId: string,
    filters: { granteeActorId?: string; scopeActorId?: string; status?: string }
  ): Promise<ActorCapabilityGrant[]> {
    const where: string[] = ['tenant_id = $1::uuid'];
    const params: unknown[] = [tenantId];
    if (filters.granteeActorId) { params.push(filters.granteeActorId); where.push(`grantee_actor_id = $${params.length}::uuid`); }
    if (filters.scopeActorId) { params.push(filters.scopeActorId); where.push(`scope_actor_id = $${params.length}::uuid`); }
    if (filters.status) { params.push(filters.status); where.push(`status = $${params.length}`); }
    const rows = await runQueriesWithTenant<GrantRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM actor_capability_grants WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return rows.map(toGrant);
  },

  /**
   * Revoga via fn_revoke_actor_capability_grant (state+evento revoked atômico; actor-only; reason da
   * concessão NUNCA é alterado — revoke_reason é campo próprio). N2-D.2-R2: o tenant esperado (server-side)
   * é o PRIMEIRO argumento — a função no banco rejeita grant de outro tenant como NOT_FOUND (não-vazante) e
   * valida coerência tenant dos Actors. null se o grant não existir/não estiver active/for de outro tenant.
   */
  async revoke(
    tenantId: string,
    grantId: string,
    executedByActorId: string,
    revokeReason: string,
    executedByUserId: string,
    responsibleHumanActorId: string
  ): Promise<ActorCapabilityGrant | null> {
    try {
      const row = await runQueryWithTenant<GrantRow>(
        tenantId,
        `SELECT ${SELECT_COLS} FROM fn_revoke_actor_capability_grant($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6) AS g`,
        [tenantId, grantId, executedByUserId, executedByActorId, responsibleHumanActorId, revokeReason]
      );
      return row ? toGrant(row) : null;
    } catch (error: any) {
      const msg = error?.message || '';
      if (/ACTOR_CAPABILITY_GRANT_NOT_FOUND|ACTOR_CAPABILITY_GRANT_NOT_ACTIVE|ACTOR_CAPABILITY_GRANT_REVOKE_SCOPE_MISMATCH/.test(msg)) {
        return null;
      }
      throw error;
    }
  },
};
