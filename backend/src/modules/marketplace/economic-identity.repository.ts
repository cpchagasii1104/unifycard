// backend/src/modules/marketplace/economic-identity.repository.ts
// FASE X — Bloco 1: Economic Identity (persistência apenas)

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface EconomicIdentityRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  actor_type: string;
  trust_score_bps: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface EconomicIdentityEventRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  event_type: string;
  value_delta: number;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateIdentityInput {
  actorType: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
}

export interface AppendEventInput {
  eventType: string;
  valueDelta: number;
  metadata?: Record<string, unknown>;
}

class EconomicIdentityRepository {
  async createIdentity(
    tenantId: string,
    actorId: string,
    input: CreateIdentityInput
  ): Promise<EconomicIdentityRow> {
    const row = await runQueryWithTenant<EconomicIdentityRow>(
      tenantId,
      `
      INSERT INTO economic_identities (tenant_id, actor_id, actor_type, trust_score_bps, status)
      VALUES ($1, $2, $3, 0, 'active')
      ON CONFLICT (tenant_id, actor_id) DO UPDATE SET
        actor_type = EXCLUDED.actor_type,
        updated_at = now()
      RETURNING id, tenant_id, actor_id, actor_type, trust_score_bps, status, created_at, updated_at
      `,
      [tenantId, actorId, input.actorType]
    );
    if (!row) {
      throw new Error('Economic identity not created');
    }
    return row;
  }

  async getByActorId(tenantId: string, actorId: string): Promise<EconomicIdentityRow | null> {
    const rows = await runQueriesWithTenant<EconomicIdentityRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, actor_type, trust_score_bps, status, created_at, updated_at
      FROM economic_identities
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId]
    );
    return rows[0] ?? null;
  }

  async appendEvent(
    tenantId: string,
    actorId: string,
    input: AppendEventInput
  ): Promise<EconomicIdentityEventRow> {
    const row = await runQueryWithTenant<EconomicIdentityEventRow>(
      tenantId,
      `
      INSERT INTO economic_identity_events (tenant_id, actor_id, event_type, value_delta, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, tenant_id, actor_id, event_type, value_delta, metadata, created_at
      `,
      [
        tenantId,
        actorId,
        input.eventType,
        input.valueDelta,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );
    if (!row) {
      throw new Error('Economic identity event not appended');
    }
    return row;
  }

  async listEvents(
    tenantId: string,
    actorId: string,
    limit = 100
  ): Promise<EconomicIdentityEventRow[]> {
    const rows = await runQueriesWithTenant<EconomicIdentityEventRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, event_type, value_delta, metadata, created_at
      FROM economic_identity_events
      WHERE tenant_id = $1 AND actor_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [tenantId, actorId, limit]
    );
    return rows;
  }

  async updateTrustScoreBps(
    tenantId: string,
    actorId: string,
    trustScoreBps: number
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE economic_identities
      SET trust_score_bps = $3, updated_at = now()
      WHERE tenant_id = $1 AND actor_id = $2
      `,
      [tenantId, actorId, trustScoreBps]
    );
  }
}

export const economicIdentityRepository = new EconomicIdentityRepository();