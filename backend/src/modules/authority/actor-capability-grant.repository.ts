// backend/src/modules/authority/actor-capability-grant.repository.ts
// F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136). Repository mínimo, tenant-safe. Zero enforcement de rota.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ActorCapabilityGrant } from './actor-capability-grant.types';

interface GrantRow {
  grant_id: string;
  tenant_id: string;
  grantee_actor_id: string;
  capability_key: string;
  scope_type: string;
  scope_actor_id: string;
  granted_by_user_id: string;
  granted_by_actor_id: string;
  authority_source: string;
  status: string;
  valid_from: string;
  valid_until: string | null;
  revoked_at: string | null;
  revoked_by_actor_id: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS = `
  grant_id::text, tenant_id::text, grantee_actor_id::text, capability_key, scope_type,
  scope_actor_id::text, granted_by_user_id::text, granted_by_actor_id::text, authority_source,
  status, valid_from, valid_until, revoked_at, revoked_by_actor_id::text, reason, created_at, updated_at
`;

function toGrant(r: GrantRow): ActorCapabilityGrant {
  return {
    grantId: r.grant_id,
    tenantId: r.tenant_id,
    granteeActorId: r.grantee_actor_id,
    capabilityKey: r.capability_key,
    scopeType: r.scope_type as 'actor',
    scopeActorId: r.scope_actor_id,
    grantedByUserId: r.granted_by_user_id,
    grantedByActorId: r.granted_by_actor_id,
    authoritySource: r.authority_source,
    status: r.status as ActorCapabilityGrant['status'],
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    revokedAt: r.revoked_at,
    revokedByActorId: r.revoked_by_actor_id,
    reason: r.reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const actorCapabilityGrantRepository = {
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
    }
  ): Promise<ActorCapabilityGrant> {
    const row = await runQueryWithTenant<GrantRow>(
      tenantId,
      `INSERT INTO actor_capability_grants
        (tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id,
         granted_by_user_id, granted_by_actor_id, authority_source, status, valid_until, reason)
       VALUES ($1::uuid,$2::uuid,$3,'actor',$4::uuid,$5::uuid,$6::uuid,$7,'active',$8,$9)
       RETURNING ${SELECT_COLS}`,
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
      ]
    );
    if (!row) throw new Error('Falha ao gravar capability grant');
    return toGrant(row);
  },

  /** Grant ATIVO específico (tenant + grantee + capability + scope). null se não houver. */
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

  /** Revoga (idempotência por estado: só active→revoked). Retorna o grant pós-update ou null. */
  async revoke(
    tenantId: string,
    grantId: string,
    revokedByActorId: string,
    reason: string | null
  ): Promise<ActorCapabilityGrant | null> {
    const row = await runQueryWithTenant<GrantRow>(
      tenantId,
      `UPDATE actor_capability_grants
        SET status='revoked', revoked_at=now(), revoked_by_actor_id=$3::uuid,
            reason=COALESCE($4, reason), updated_at=now()
        WHERE tenant_id=$1::uuid AND grant_id=$2::uuid AND status='active'
        RETURNING ${SELECT_COLS}`,
      [tenantId, grantId, revokedByActorId, reason]
    );
    return row ? toGrant(row) : null;
  },
};
