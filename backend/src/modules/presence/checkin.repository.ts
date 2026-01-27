// backend/src/modules/presence/checkin.repository.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Checkin,
  PresenceContextType,
  CheckinType,
  CheckinStatus,
} from './presence.types';

interface CheckinRow {
  id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  contact_id: string;
  token_id: string | null;
  checkin_type: string;
  status: string;
  reference_event_id: string | null;
  metadata: any;
  created_at: Date;
}

class CheckinRepository {
  private toCheckin(row: CheckinRow): Checkin {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      contactId: row.contact_id,
      tokenId: row.token_id,
      checkinType: row.checkin_type as CheckinType,
      status: row.status as CheckinStatus,
      referenceEventId: row.reference_event_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  async createCheckin(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string,
    checkinType: CheckinType,
    tokenId: string | null,
    referenceEventId: string | null
  ): Promise<Checkin> {
    // Tentar inserir CHECKED_IN (idempotente)
    const row = await runQueryWithTenant<CheckinRow>(
      tenantId,
      `
      INSERT INTO checkins (
        tenant_id, context_type, context_id, contact_id, checkin_type,
        status, token_id, reference_event_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'CHECKED_IN', $6, $7, '{}'::jsonb)
      ON CONFLICT (tenant_id, context_type, context_id, contact_id, status) DO NOTHING
      ON CONFLICT (tenant_id, reference_event_id) DO NOTHING
      RETURNING id, tenant_id, context_type, context_id, contact_id, token_id,
                checkin_type, status, reference_event_id, metadata, created_at
      `,
      [tenantId, contextType, contextId, contactId, checkinType, tokenId, referenceEventId]
    );

    // Se já existe (idempotência), buscar existente
    if (!row) {
      const existing = await runQueryWithTenant<CheckinRow>(
        tenantId,
        `
        SELECT id, tenant_id, context_type, context_id, contact_id, token_id,
               checkin_type, status, reference_event_id, metadata, created_at
        FROM checkins
        WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND contact_id = $4 AND status = 'CHECKED_IN'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [tenantId, contextType, contextId, contactId]
      );

      if (!existing) {
        throw new Error('Erro ao criar check-in');
      }

      return this.toCheckin(existing);
    }

    return this.toCheckin(row);
  }

  async createCheckout(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<Checkin> {
    const row = await runQueryWithTenant<CheckinRow>(
      tenantId,
      `
      INSERT INTO checkins (
        tenant_id, context_type, context_id, contact_id, checkin_type,
        status, metadata
      )
      VALUES ($1, $2, $3, $4, 'MANUAL', 'CHECKED_OUT', '{}'::jsonb)
      RETURNING id, tenant_id, context_type, context_id, contact_id, token_id,
                checkin_type, status, reference_event_id, metadata, created_at
      `,
      [tenantId, contextType, contextId, contactId]
    );

    if (!row) {
      throw new Error('Erro ao criar check-out');
    }

    return this.toCheckin(row);
  }

  async hasCheckedIn(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<boolean> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::TEXT as count
      FROM checkins
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND contact_id = $4 AND status = 'CHECKED_IN'
      `,
      [tenantId, contextType, contextId, contactId]
    );

    return row ? parseInt(row.count, 10) > 0 : false;
  }

  async listCheckins(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Checkin[]> {
    const rows = await runQueriesWithTenant<CheckinRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, contact_id, token_id,
             checkin_type, status, reference_event_id, metadata, created_at
      FROM checkins
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
      ORDER BY created_at DESC
      LIMIT $4 OFFSET $5
      `,
      [tenantId, contextType, contextId, limit, offset]
    );

    return rows.map((row) => this.toCheckin(row));
  }
}

export const checkinRepository = new CheckinRepository();





