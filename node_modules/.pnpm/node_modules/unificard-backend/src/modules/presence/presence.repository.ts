// backend/src/modules/presence/presence.repository.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PresenceRsvp,
  PresenceRsvpStatus,
  PresenceVisibility,
  PresenceContextType,
  PresenceFilters,
} from './presence.types';

interface PresenceRsvpRow {
  id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  contact_id: string;
  status: string;
  visibility: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  attendedAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class PresenceRepository {
  private toPresenceRsvp(row: PresenceRsvpRow): PresenceRsvp {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contextType: row.context_type as PresenceContextType,
      contextId: row.context_id,
      contactId: row.contact_id,
      status: row.status as PresenceRsvpStatus,
      visibility: row.visibility as PresenceVisibility,
      confirmedAt: row.confirmedAt,
      cancelledAt: row.cancelledAt,
      attendedAt: row.attendedAt,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async confirmPresence(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string,
    visibility: PresenceVisibility = 'PRIVATE'
  ): Promise<PresenceRsvp> {
    const now = new Date();

    const row = await runQueryWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      INSERT INTO presence_rsvps (
        tenant_id, context_type, context_id, contact_id, status, visibility,
        confirmedAt, metadata
      )
      VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6, '{}'::jsonb)
      ON CONFLICT (tenant_id, context_type, context_id, contact_id)
      DO UPDATE SET
        status = 'CONFIRMED',
        visibility = EXCLUDED.visibility,
        confirmedAt = $6,
        updatedAt = NOW()
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, visibility,
                confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      `,
      [tenantId, contextType, contextId, contactId, visibility, now]
    );

    if (!row) {
      throw new Error('Erro ao confirmar presença');
    }

    return this.toPresenceRsvp(row);
  }

  async cancelPresence(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<PresenceRsvp> {
    const now = new Date();

    const row = await runQueryWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      UPDATE presence_rsvps
      SET status = 'CANCELLED',
          cancelledAt = $1,
          updatedAt = NOW()
      WHERE tenant_id = $2 AND context_type = $3 AND context_id = $4 AND contact_id = $5
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, visibility,
                confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      `,
      [now, tenantId, contextType, contextId, contactId]
    );

    if (!row) {
      throw new Error('RSVP não encontrado');
    }

    return this.toPresenceRsvp(row);
  }

  async setVisibility(
    tenantId: string,
    rsvpId: string,
    visibility: PresenceVisibility
  ): Promise<PresenceRsvp> {
    const row = await runQueryWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      UPDATE presence_rsvps
      SET visibility = $1,
          updatedAt = NOW()
      WHERE tenant_id = $2 AND id = $3
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, visibility,
                confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      `,
      [visibility, tenantId, rsvpId]
    );

    if (!row) {
      throw new Error('RSVP não encontrado');
    }

    return this.toPresenceRsvp(row);
  }

  async markAsAttended(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<PresenceRsvp> {
    const now = new Date();

    const row = await runQueryWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      UPDATE presence_rsvps
      SET status = 'ATTENDED',
          attendedAt = $1,
          updatedAt = NOW()
      WHERE tenant_id = $2 AND context_type = $3 AND context_id = $4 AND contact_id = $5
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, visibility,
                confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      `,
      [now, tenantId, contextType, contextId, contactId]
    );

    if (!row) {
      // Se não existe RSVP, criar um com status ATTENDED
      return await this.confirmPresence(tenantId, contextType, contextId, contactId, 'PRIVATE');
    }

    return this.toPresenceRsvp(row);
  }

  async markAsNoShow(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<PresenceRsvp> {
    const row = await runQueryWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      UPDATE presence_rsvps
      SET status = 'NO_SHOW',
          updatedAt = NOW()
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND contact_id = $4
      RETURNING id, tenant_id, context_type, context_id, contact_id, status, visibility,
                confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      `,
      [tenantId, contextType, contextId, contactId]
    );

    if (!row) {
      throw new Error('RSVP não encontrado');
    }

    return this.toPresenceRsvp(row);
  }

  async getRsvpByContact(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    contactId: string
  ): Promise<PresenceRsvp | null> {
    const row = await runQueryWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, contact_id, status, visibility,
             confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      FROM presence_rsvps
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND contact_id = $4
      `,
      [tenantId, contextType, contextId, contactId]
    );

    return row ? this.toPresenceRsvp(row) : null;
  }

  async listPresence(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string,
    filters: PresenceFilters = {}
  ): Promise<PresenceRsvp[]> {
    const conditions: string[] = ['tenant_id = $1', 'context_type = $2', 'context_id = $3'];
    const params: any[] = [tenantId, contextType, contextId];
    let paramIndex = 4;

    // Por default, mostrar apenas PUBLIC
    if (filters.visibility === undefined) {
      conditions.push('visibility = $' + paramIndex);
      params.push('PUBLIC');
      paramIndex++;
    } else if (filters.visibility) {
      conditions.push('visibility = $' + paramIndex);
      params.push(filters.visibility);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, contact_id, status, visibility,
             confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      FROM presence_rsvps
      WHERE ${conditions.join(' AND ')}
      ORDER BY confirmedAt DESC NULLS LAST, createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toPresenceRsvp(row));
  }

  async listMyPresence(
    tenantId: string,
    contactId: string,
    filters: PresenceFilters = {}
  ): Promise<PresenceRsvp[]> {
    const conditions: string[] = ['tenant_id = $1', 'contact_id = $2'];
    const params: any[] = [tenantId, contactId];
    let paramIndex = 3;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.visibility) {
      conditions.push(`visibility = $${paramIndex}`);
      params.push(filters.visibility);
      paramIndex++;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<PresenceRsvpRow>(
      tenantId,
      `
      SELECT id, tenant_id, context_type, context_id, contact_id, status, visibility,
             confirmedAt, cancelledAt, attendedAt, metadata, createdAt, updatedAt
      FROM presence_rsvps
      WHERE ${conditions.join(' AND ')}
      ORDER BY confirmedAt DESC NULLS LAST, createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toPresenceRsvp(row));
  }

  async getAttendanceStats(
    tenantId: string,
    contextType: PresenceContextType,
    contextId: string
  ): Promise<{
    confirmed: number;
    attended: number;
    noShow: number;
    cancelled: number;
  }> {
    const row = await runQueryWithTenant<{
      confirmed: string;
      attended: string;
      no_show: string;
      cancelled: string;
    }>(
      tenantId,
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'CONFIRMED')::TEXT as confirmed,
        COUNT(*) FILTER (WHERE status = 'ATTENDED')::TEXT as attended,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW')::TEXT as no_show,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::TEXT as cancelled
      FROM presence_rsvps
      WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
      `,
      [tenantId, contextType, contextId]
    );

    if (!row) {
      return { confirmed: 0, attended: 0, noShow: 0, cancelled: 0 };
    }

    return {
      confirmed: parseInt(row.confirmed, 10),
      attended: parseInt(row.attended, 10),
      noShow: parseInt(row.no_show, 10),
      cancelled: parseInt(row.cancelled, 10),
    };
  }
}

export const presenceRepository = new PresenceRepository();







