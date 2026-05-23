// src/modules/work/work-event-outbox.helper.ts
// INFRA-1: entrega via outbox (TX isolada). Sem alterar semântica dos eventos Work.

import { createHash } from 'crypto';
import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';

export function deterministicWorkEventId(
  tenantId: string,
  entityId: string,
  eventType: string,
  extraKey?: string
): string {
  const seed = extraKey
    ? `${eventType}:${tenantId}:${entityId}:${extraKey}`
    : `${eventType}:${tenantId}:${entityId}`;
  const hash = createHash('sha256').update(seed).digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export async function insertWorkEventOutbox(
  tenantId: string,
  eventType: string,
  entityId: string,
  extraKey: string | undefined,
  payload: Record<string, unknown>
): Promise<void> {
  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');
    await insertEventOutboxRow(client, {
      tenantId,
      eventId: deterministicWorkEventId(tenantId, entityId, eventType, extraKey),
      eventType,
      eventVersion: 1,
      payload,
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}