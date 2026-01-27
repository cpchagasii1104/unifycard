// backend/src/modules/trust/trust.repository.ts
// Repository para Trust Profiles, Events e Score Snapshots
// 🔴 BLINDAGEM: Append-only em eventos, imutável após criação

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  TrustProfile,
  TrustEvent,
  TrustScoreSnapshot,
  RegisterTrustEventInput,
  TrustProfileFilters,
  TrustEventFilters,
} from './trust.types';

interface TrustProfileRow {
  profile_id: string;
  tenant_id: string;
  actor_id: string;
  current_score: number;
  risk_level: string;
  total_events: number;
  positive_events: number;
  negative_events: number;
  last_event_at: Date | null;
  last_updated_at: Date;
  created_at: Date;
}

interface TrustEventRow {
  event_id: string;
  tenant_id: string;
  actor_id: string;
  event_type: string;
  severity: string;
  score_impact: number;
  context_type: string;
  context_id: string;
  evidence_pack_id: string;
  metadata: any;
  created_at: Date;
}

interface TrustScoreSnapshotRow {
  snapshot_id: string;
  tenant_id: string;
  actor_id: string;
  score: number;
  risk_level: string;
  triggered_by_event_id: string | null;
  metadata: any;
  created_at: Date;
}

class TrustRepository {
  private toTrustProfile(row: TrustProfileRow): TrustProfile {
    return {
      profileId: row.profile_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      currentScore: row.current_score,
      riskLevel: row.risk_level as any,
      totalEvents: row.total_events,
      positiveEvents: row.positive_events,
      negativeEvents: row.negative_events,
      lastEventAt: row.last_event_at,
      lastUpdatedAt: row.last_updated_at,
      createdAt: row.created_at,
    };
  }

  private toTrustEvent(row: TrustEventRow): TrustEvent {
    return {
      eventId: row.event_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      eventType: row.event_type as any,
      severity: row.severity as any,
      scoreImpact: row.score_impact,
      contextType: row.context_type as any,
      contextId: row.context_id,
      evidencePackId: row.evidence_pack_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private toTrustScoreSnapshot(row: TrustScoreSnapshotRow): TrustScoreSnapshot {
    return {
      snapshotId: row.snapshot_id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      score: row.score,
      riskLevel: row.risk_level as any,
      triggeredByEventId: row.triggered_by_event_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  /**
   * Cria ou obtém trust profile para um actor
   */
  async getOrCreateProfile(tenantId: string, actorId: string): Promise<TrustProfile> {
    // Tentar buscar profile existente
    const existing = await this.findByActor(tenantId, actorId);
    if (existing) {
      return existing;
    }

    // Criar novo profile com score inicial neutro (70)
    const { randomUUID } = await import('crypto');
    const profileId = randomUUID();

    const rows = await runQueriesWithTenant(
      tenantId,
      [
        {
          text: `
            INSERT INTO trust_profiles (
              profile_id, tenant_id, actor_id, current_score, risk_level
            ) VALUES (
              $1, $2, $3, $4, $5
            ) RETURNING *
          `,
          values: [profileId, tenantId, actorId, 70, 'MEDIUM'],
        },
      ],
      'trust.repository.getOrCreateProfile'
    );

    return this.toTrustProfile(rows[0] as TrustProfileRow);
  }

  /**
   * Busca trust profile por actor
   */
  async findByActor(tenantId: string, actorId: string): Promise<TrustProfile | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM trust_profiles
          WHERE tenant_id = $1 AND actor_id = $2
        `,
        values: [tenantId, actorId],
      },
      'trust.repository.findByActor'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toTrustProfile(rows[0] as TrustProfileRow);
  }

  /**
   * Atualiza score e risk level do profile
   */
  async updateScore(
    tenantId: string,
    actorId: string,
    newScore: number,
    riskLevel: string,
    isPositive: boolean
  ): Promise<TrustProfile> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE trust_profiles
          SET 
            current_score = $3,
            risk_level = $4,
            total_events = total_events + 1,
            ${isPositive ? 'positive_events = positive_events + 1' : 'negative_events = negative_events + 1'},
            last_event_at = NOW(),
            last_updated_at = NOW()
          WHERE tenant_id = $1 AND actor_id = $2
          RETURNING *
        `,
        values: [tenantId, actorId, newScore, riskLevel],
      },
      'trust.repository.updateScore'
    );

    return this.toTrustProfile(rows[0] as TrustProfileRow);
  }

  /**
   * Cria trust event (append-only)
   */
  async createEvent(tenantId: string, input: RegisterTrustEventInput, scoreImpact: number): Promise<TrustEvent> {
    const { randomUUID } = await import('crypto');
    const eventId = randomUUID();

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO trust_events (
            event_id, tenant_id, actor_id, event_type, severity,
            score_impact, context_type, context_id, evidence_pack_id, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) RETURNING *
        `,
        values: [
          eventId,
          tenantId,
          input.actorId,
          input.eventType,
          input.severity,
          scoreImpact,
          input.contextType,
          input.contextId,
          input.evidencePackId,
          JSON.stringify(input.metadata || {}),
        ],
      },
      'trust.repository.createEvent'
    );

    return this.toTrustEvent(rows[0] as TrustEventRow);
  }

  /**
   * Cria score snapshot (append-only)
   */
  async createSnapshot(
    tenantId: string,
    actorId: string,
    score: number,
    riskLevel: string,
    triggeredByEventId: string | null
  ): Promise<TrustScoreSnapshot> {
    const { randomUUID } = await import('crypto');
    const snapshotId = randomUUID();

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO trust_score_snapshots (
            snapshot_id, tenant_id, actor_id, score, risk_level,
            triggered_by_event_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6
          ) RETURNING *
        `,
        values: [snapshotId, tenantId, actorId, score, riskLevel, triggeredByEventId],
      },
      'trust.repository.createSnapshot'
    );

    return this.toTrustScoreSnapshot(rows[0] as TrustScoreSnapshotRow);
  }

  /**
   * Lista trust events com filtros
   */
  async listEvents(tenantId: string, filters: TrustEventFilters = {}): Promise<TrustEvent[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      values.push(filters.actorId);
      paramIndex++;
    }

    if (filters.eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      values.push(filters.eventType);
      paramIndex++;
    }

    if (filters.severity) {
      conditions.push(`severity = $${paramIndex}`);
      values.push(filters.severity);
      paramIndex++;
    }

    if (filters.contextType) {
      conditions.push(`context_type = $${paramIndex}`);
      values.push(filters.contextType);
      paramIndex++;
    }

    if (filters.contextId) {
      conditions.push(`context_id = $${paramIndex}`);
      values.push(filters.contextId);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM trust_events
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'trust.repository.listEvents'
    );

    return rows.map((row) => this.toTrustEvent(row as TrustEventRow));
  }

  /**
   * Lista trust profiles com filtros
   */
  async listProfiles(tenantId: string, filters: TrustProfileFilters = {}): Promise<TrustProfile[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      values.push(filters.actorId);
      paramIndex++;
    }

    if (filters.riskLevel) {
      conditions.push(`risk_level = $${paramIndex}`);
      values.push(filters.riskLevel);
      paramIndex++;
    }

    if (filters.minScore !== undefined) {
      conditions.push(`current_score >= $${paramIndex}`);
      values.push(filters.minScore);
      paramIndex++;
    }

    if (filters.maxScore !== undefined) {
      conditions.push(`current_score <= $${paramIndex}`);
      values.push(filters.maxScore);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM trust_profiles
          WHERE ${conditions.join(' AND ')}
          ORDER BY current_score DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'trust.repository.listProfiles'
    );

    return rows.map((row) => this.toTrustProfile(row as TrustProfileRow));
  }

  /**
   * Lista score snapshots de um actor
   */
  async listSnapshots(
    tenantId: string,
    actorId: string,
    limit: number = 100
  ): Promise<TrustScoreSnapshot[]> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM trust_score_snapshots
          WHERE tenant_id = $1 AND actor_id = $2
          ORDER BY created_at DESC
          LIMIT $3
        `,
        values: [tenantId, actorId, limit],
      },
      'trust.repository.listSnapshots'
    );

    return rows.map((row) => this.toTrustScoreSnapshot(row as TrustScoreSnapshotRow));
  }
}

export const trustRepository = new TrustRepository();




