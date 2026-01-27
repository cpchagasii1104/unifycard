// backend/src/core/actor-delegation/actor-delegation.repository.ts
// CONTINUOUS PRODUCTION: Repository para delegações entre actors

import { runQueryWithTenant } from '@core/database/pool';

export interface ActorDelegation {
  delegationId: string;
  tenantId: string;
  userActorId: string;
  institutionalActorId: string;
  scopes: string[];
  isTransitive: boolean;
  expiresAt?: Date;
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
}

export interface CreateActorDelegationInput {
  userActorId: string;
  institutionalActorId: string;
  scopes: string[];
  isTransitive?: boolean;
  expiresAt?: Date;
}

class ActorDelegationRepository {
  /**
   * Cria delegação
   */
  async create(
    tenantId: string,
    input: CreateActorDelegationInput
  ): Promise<ActorDelegation> {
    // Revogar delegações anteriores ativas (se existirem)
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE actor_delegations
        SET status = 'revoked', revoked_at = NOW()
        WHERE tenant_id = $1
          AND user_actor_id = $2
          AND institutional_actor_id = $3
          AND status = 'active'
      `,
      [tenantId, input.userActorId, input.institutionalActorId]
    );

    const result = await runQueryWithTenant<{
      delegation_id: string;
      tenant_id: string;
      user_actor_id: string;
      institutional_actor_id: string;
      scopes_json: any;
      is_transitive: boolean;
      expires_at: Date | null;
      status: string;
      created_at: Date;
      updated_at: Date;
      revoked_at: Date | null;
    }>(
      tenantId,
      `
        INSERT INTO actor_delegations (
          tenant_id, user_actor_id, institutional_actor_id,
          scopes_json, is_transitive, expires_at, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING *
      `,
      [
        tenantId,
        input.userActorId,
        input.institutionalActorId,
        JSON.stringify(input.scopes),
        input.isTransitive || false,
        input.expiresAt || null,
      ]
    );

    const row = result[0];
    return {
      delegationId: row.delegation_id,
      tenantId: row.tenant_id,
      userActorId: row.user_actor_id,
      institutionalActorId: row.institutional_actor_id,
      scopes: row.scopes_json || [],
      isTransitive: row.is_transitive,
      expiresAt: row.expires_at || undefined,
      status: row.status as 'active' | 'revoked' | 'expired',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revokedAt: row.revoked_at || undefined,
    };
  }

  /**
   * Busca delegações ativas por user_actor
   */
  async findActiveByUserActor(
    tenantId: string,
    userActorId: string
  ): Promise<ActorDelegation[]> {
    const result = await runQueryWithTenant<{
      delegation_id: string;
      tenant_id: string;
      user_actor_id: string;
      institutional_actor_id: string;
      scopes_json: any;
      is_transitive: boolean;
      expires_at: Date | null;
      status: string;
      created_at: Date;
      updated_at: Date;
      revoked_at: Date | null;
    }>(
      tenantId,
      `
        SELECT *
        FROM actor_delegations
        WHERE tenant_id = $1
          AND user_actor_id = $2
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
      `,
      [tenantId, userActorId]
    );

    return result.map((row) => ({
      delegationId: row.delegation_id,
      tenantId: row.tenant_id,
      userActorId: row.user_actor_id,
      institutionalActorId: row.institutional_actor_id,
      scopes: row.scopes_json || [],
      isTransitive: row.is_transitive,
      expiresAt: row.expires_at || undefined,
      status: row.status as 'active' | 'revoked' | 'expired',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revokedAt: row.revoked_at || undefined,
    }));
  }

  /**
   * Revoga delegação
   */
  async revoke(
    tenantId: string,
    delegationId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ delegation_id: string }>(
      tenantId,
      `
        UPDATE actor_delegations
        SET status = 'revoked', revoked_at = NOW()
        WHERE tenant_id = $1 AND delegation_id = $2 AND status = 'active'
        RETURNING delegation_id
      `,
      [tenantId, delegationId]
    );

    return result.length > 0;
  }
}

export const actorDelegationRepository = new ActorDelegationRepository();







