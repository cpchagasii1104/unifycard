/**
 * Prompt 53 — actor_events (histórico imutável).
 */

import { runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';
import { isActorIdInTenant } from '@modules/identity/actor-ssot.service';

export interface ActorEventRow {
  id: string;
  tenantId: string;
  actorId: string;
  eventType: string;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function recordEvent(
  tenantId: string,
  input: {
    actorId: string;
    eventType: string;
    referenceId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const ok = await isActorIdInTenant(tenantId, input.actorId);
  if (!ok) throw new Error('ACTOR_EVENTS_TENANT_MISMATCH');

  const row = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `INSERT INTO actor_events (tenant_id, actor_id, event_type, reference_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [
      tenantId,
      input.actorId,
      input.eventType.slice(0, 128),
      input.referenceId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  if (!row) throw new Error('recordEvent failed');
  return row.id;
}

export async function listEventsByActor(
  tenantId: string,
  actorId: string,
  limit = 100
): Promise<ActorEventRow[]> {
  const rows = await runQueriesWithTenant<{
    id: string;
    tenant_id: string;
    actor_id: string;
    event_type: string;
    reference_id: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    tenantId,
    `SELECT id, tenant_id, actor_id, event_type, reference_id, metadata, created_at
     FROM actor_events
     WHERE tenant_id = $1 AND actor_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [tenantId, actorId, Math.min(500, limit)]
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    actorId: r.actor_id,
    eventType: r.event_type,
    referenceId: r.reference_id,
    metadata: r.metadata || {},
    createdAt: r.created_at.toISOString(),
  }));
}

export async function countEventsByTypeSince(
  tenantId: string,
  actorId: string,
  eventTypes: string[],
  since: Date
): Promise<Map<string, number>> {
  if (eventTypes.length === 0) return new Map();
  const rows = await runQueriesWithTenant<{ event_type: string; c: string }>(
    tenantId,
    `SELECT event_type, COUNT(*)::text AS c FROM actor_events
     WHERE tenant_id = $1 AND actor_id = $2 AND created_at >= $3
       AND event_type = ANY($4::text[])
     GROUP BY event_type`,
    [tenantId, actorId, since.toISOString(), eventTypes]
  );
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    m.set(r.event_type, Number(r.c));
  }
  return m;
}