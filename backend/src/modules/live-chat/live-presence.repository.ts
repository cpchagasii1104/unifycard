// backend/src/modules/live-chat/live-presence.repository.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  LivePresence,
  LivePresenceStatus,
  PresenceContextType,
} from './live-chat.types';

interface LivePresenceRow {
  id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  contact_id: string;
  status: string;
  opted_in: boolean;
  last_seen_at: Date;
  expires_at: Date;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class LivePresenceRepository {
  private toLivePresence(row: LivePresenceRow): LivePresence {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      contactId: row.contact_id,
      status: row.status as LivePresenceStatus,
      optedIn: row.opted_in,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async optIn(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string,
    expiresAt: Date
  ): Promise<LivePresence> {
    const now = new Date();

    const row = await runQueryWithTenant<LivePresenceRow>(
      tenantId,
      `
      INSERT INTO live_presence (
        tenant_id, context_type, context_id, contact_id, status, opted_in,
        last_seen_at, expires_at, metadata
      )
      VALUES ($1, $2, $3, $4, 'ONLINE', true, $5, $6, '{}'::jsonb)
      ON CONFLICT (tenant_id, context_type, context_id, contact_id)
      DO UPDATE SET
        status = 'ONLINE',
        opted_in = true,
        last_seen_at = $5,
        expires_at = $6,
        updated_at = NOW()
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, opted_in,
                last_seen_at, expires_at, metadata, created_at, updated_at
      `,
      [tenantId, contextType, contextId, contactId, now, expiresAt]
    );

    if (!row) {
      throw new Error('Erro ao opt-in de presença ao vivo');
    }

    return this.toLivePresence(row);
  }

  async optOut(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<LivePresence> {
    const row = await runQueryWithTenant<LivePresenceRow>(
      tenantId,
      `
      UPDATE live_presence
      SET status = 'OFFLINE',
          opted_in = false,
          updated_at = NOW()
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND contact_id = $4
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, opted_in,
                last_seen_at, expires_at, metadata, created_at, updated_at
      `,
      [tenantId, contextType, contextId, contactId]
    );

    if (!row) {
      throw new Error('Presença ao vivo não encontrada');
    }

    return this.toLivePresence(row);
  }

  async heartbeat(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string,
    expiresAt: Date
  ): Promise<LivePresence> {
    const now = new Date();

    const row = await runQueryWithTenant<LivePresenceRow>(
      tenantId,
      `
      UPDATE live_presence
      SET last_seen_at = $1,
          expires_at = $2,
          updated_at = NOW()
      WHERE tenant_id = $3 AND context_type = $4 AND context_id = $5 AND contact_id = $6
        AND opted_in = true
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, opted_in,
                last_seen_at, expires_at, metadata, created_at, updated_at
      `,
      [now, expiresAt, tenantId, contextType, contextId, contactId]
    );

    if (!row) {
      throw new Error('Presença ao vivo não encontrada ou não opt-in');
    }

    return this.toLivePresence(row);
  }

  async listOnline(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    limit: number = 50
  ): Promise<LivePresence[]> {
    const now = new Date();

    const rows = await runQueriesWithTenant<LivePresenceRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, contact_id, status, opted_in,
             last_seen_at, expires_at, metadata, created_at, updated_at
      FROM live_presence
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
        AND opted_in = true
        AND status = 'ONLINE'
        AND expires_at > $4
      ORDER BY last_seen_at DESC
      LIMIT $5
      `,
      [tenantId, contextType, contextId, now, limit]
    );

    return rows.map((row) => this.toLivePresence(row));
  }

  async getPresence(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<LivePresence | null> {
    const row = await runQueryWithTenant<LivePresenceRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, contact_id, status, opted_in,
             last_seen_at, expires_at, metadata, created_at, updated_at
      FROM live_presence
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND contact_id = $4
      `,
      [tenantId, contextType, contextId, contactId]
    );

    return row ? this.toLivePresence(row) : null;
  }
}

export const livePresenceRepository = new LivePresenceRepository();







