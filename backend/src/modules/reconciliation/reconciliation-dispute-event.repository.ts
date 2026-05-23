/**
 * Append-only: apenas INSERT e SELECT. Sem UPDATE/DELETE.
 */

import type { PoolClient } from 'pg';
import { runQueriesWithTenant } from '@core/database/pool';

export type ReconciliationDisputeEventType =
  | 'dispute_created'
  | 'moved_to_under_review'
  | 'resolved'
  | 'reversed';

export interface ReconciliationDisputeEventRow {
  id: string;
  tenantId: string;
  disputeId: string;
  eventType: ReconciliationDisputeEventType;
  actorKind: string;
  actorId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

function sanitizeParams(params: unknown[]): unknown[] {
  return params.map((p) => (p === undefined ? null : p));
}

/** Mesma conexão/transação; exige tenant já configurado no client. */
export async function insertReconciliationDisputeEventWithClient(
  client: PoolClient,
  tenantId: string,
  input: {
    disputeId: string;
    eventType: ReconciliationDisputeEventType;
    actorKind: string;
    actorId: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    payload: Record<string, unknown> | null;
  }
): Promise<ReconciliationDisputeEventRow> {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    dispute_id: string;
    event_type: string;
    actor_kind: string;
    actor_id: string | null;
    from_status: string | null;
    to_status: string | null;
    payload: unknown;
    created_at: Date;
  }>(
    `INSERT INTO reconciliation_dispute_events (
       tenant_id, dispute_id, event_type, actor_kind, actor_id, from_status, to_status, payload
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id, tenant_id, dispute_id, event_type, actor_kind, actor_id, from_status, to_status, payload, created_at`,
    sanitizeParams([
      tenantId,
      input.disputeId,
      input.eventType,
      input.actorKind,
      input.actorId,
      input.fromStatus,
      input.toStatus,
      input.payload == null ? null : JSON.stringify(input.payload),
    ])
  );
  const row = result.rows[0];
  if (!row) throw new Error('INSERT_RECONCILIATION_DISPUTE_EVENT_FAILED');
  return mapEventRow(row);
}

function mapEventRow(r: {
  id: string;
  tenant_id: string;
  dispute_id: string;
  event_type: string;
  actor_kind: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string | null;
  payload: unknown;
  created_at: Date;
}): ReconciliationDisputeEventRow {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    disputeId: r.dispute_id,
    eventType: r.event_type as ReconciliationDisputeEventType,
    actorKind: r.actor_kind,
    actorId: r.actor_id,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    payload: r.payload != null && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listReconciliationDisputeEventsByDisputeId(
  tenantId: string,
  disputeId: string
): Promise<ReconciliationDisputeEventRow[]> {
  const rows = await runQueriesWithTenant<{
    id: string;
    tenant_id: string;
    dispute_id: string;
    event_type: string;
    actor_kind: string;
    actor_id: string | null;
    from_status: string | null;
    to_status: string | null;
    payload: unknown;
    created_at: Date;
  }>(
    tenantId,
    `SELECT id, tenant_id, dispute_id, event_type, actor_kind, actor_id, from_status, to_status, payload, created_at
     FROM reconciliation_dispute_events
     WHERE tenant_id = $1 AND dispute_id = $2
     ORDER BY created_at ASC, id ASC`,
    [tenantId, disputeId]
  );
  return (rows ?? []).map(mapEventRow);
}